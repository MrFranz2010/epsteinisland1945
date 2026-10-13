import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const ROOM_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_MEMBERS = 8;
const MAX_TIME_MS = 15 * 60 * 1000;
const CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const store = getStore('polytrack-lobbies');

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function validCode(value) {
  return typeof value === 'string' && /^[A-HJ-NP-Z2-9]{6}$/.test(value);
}

function validName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length > 0 && name.length <= 20 && !/[\u0000-\u001f\u007f]/.test(name)
    ? name
    : null;
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function publicRoom(room, playerId) {
  return {
    code: room.code,
    expiresAt: room.expiresAt,
    playerId,
    members: room.members
      .map(({ id, name, bestTimeMs }) => ({ id, name, bestTimeMs }))
      .sort((a, b) => {
        if (a.bestTimeMs === null) return b.bestTimeMs === null ? a.name.localeCompare(b.name) : 1;
        if (b.bestTimeMs === null) return -1;
        return a.bestTimeMs - b.bestTimeMs || a.name.localeCompare(b.name);
      }),
  };
}

async function updateRoom(code, update) {
  const key = `room:${code}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await store.getWithMetadata(key, { type: 'json' });
    if (!current?.data) return { error: 'Lobby non trovata.', status: 404 };
    if (current.data.expiresAt <= Date.now()) return { error: 'Questa lobby è scaduta.', status: 410 };
    if (current.data.closedAt) return { error: 'Questa lobby è stata chiusa.', status: 410 };
    const result = update(current.data);
    if (result.error) return result;
    if (result.unchanged) return { room: current.data, ...result };
    if (!current.etag) {
      if (process.env.CONTEXT !== 'dev') {
        throw new Error('Netlify Blobs non ha restituito l’ETag della lobby.');
      }
      await store.setJSON(key, current.data);
      return { room: current.data, ...result };
    }
    const write = await store.setJSON(key, current.data, { onlyIfMatch: current.etag });
    if (write.modified) return { room: current.data, ...result };
  }
  return { error: 'La lobby è molto attiva. Riprova tra qualche secondo.', status: 409 };
}

async function createLobby(name) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = Array.from(randomBytes(6), (byte) => CODE_CHARACTERS[byte % CODE_CHARACTERS.length]).join('');
    const id = randomUUID();
    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    const room = {
      code,
      createdAt: now,
      expiresAt: now + ROOM_LIFETIME_MS,
      members: [{ id, name, tokenHash: tokenHash(token), bestTimeMs: null }],
    };
    const write = await store.setJSON(`room:${code}`, room, { onlyIfNew: true });
    if (write.modified) return { room, id, token };
  }
  return { error: 'Non riesco a creare una lobby ora. Riprova.', status: 503 };
}

function findMember(room, token) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 100) return null;
  const hash = tokenHash(token);
  return room.members.find((member) => member.tokenHash === hash) ?? null;
}

export default async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Metodo non supportato.' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'La richiesta non contiene JSON valido.' }, 400);
  }

  if (body?.action === 'read') {
    const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
    if (!validCode(code)) return json({ error: 'Inserisci un codice lobby valido.' }, 400);
    const current = await store.getWithMetadata(`room:${code}`, { type: 'json' });
    if (!current?.data) return json({ error: 'Lobby non trovata.' }, 404);
    if (current.data.expiresAt <= Date.now()) return json({ error: 'Questa lobby è scaduta.' }, 410);
    if (current.data.closedAt) return json({ error: 'Questa lobby è stata chiusa.' }, 410);
    const member = findMember(current.data, body.token);
    if (!member) return json({ error: 'Accesso alla lobby non autorizzato.' }, 403);
    return json(publicRoom(current.data, member.id));
  }

  if (body?.action === 'create') {
    const name = validName(body.name);
    if (!name) return json({ error: 'Il nome deve contenere da 1 a 20 caratteri.' }, 400);
    const result = await createLobby(name);
    if (result.error) return json({ error: result.error }, result.status);
    return json({
      ...publicRoom(result.room, result.id),
      token: result.token,
    }, 201);
  }

  if (body?.action === 'join') {
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const name = validName(body.name);
    if (!validCode(code)) return json({ error: 'Inserisci un codice lobby valido.' }, 400);
    if (!name) return json({ error: 'Il nome deve contenere da 1 a 20 caratteri.' }, 400);

    const id = randomUUID();
    const token = randomBytes(32).toString('base64url');
    const result = await updateRoom(code, (room) => {
      if (room.members.length >= MAX_MEMBERS) return { error: 'La lobby è piena (massimo 8 piloti).', status: 409 };
      room.members.push({ id, name, tokenHash: tokenHash(token), bestTimeMs: null });
      return { playerId: id };
    });
    if (result.error) return json({ error: result.error }, result.status);
    return json({
      ...publicRoom(result.room, id),
      token,
    }, 201);
  }

  if (body?.action === 'score') {
    const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
    const timeMs = body.timeMs;
    if (!validCode(code)) return json({ error: 'Codice lobby non valido.' }, 400);
    if (!Number.isSafeInteger(timeMs) || timeMs < 1 || timeMs > MAX_TIME_MS) {
      return json({ error: 'Il tempo ricevuto non è valido.' }, 400);
    }

    const result = await updateRoom(code, (room) => {
      const member = findMember(room, body.token);
      if (!member) return { error: 'Accesso alla lobby non autorizzato.', status: 403 };
      if (member.bestTimeMs !== null && member.bestTimeMs <= timeMs) return { unchanged: true };
      member.bestTimeMs = timeMs;
      return { updated: true };
    });
    if (result.error) return json({ error: result.error }, result.status);
    return json({
      ...publicRoom(result.room, findMember(result.room, body.token).id),
      updated: result.updated === true,
    });
  }

  if (body?.action === 'leave') {
    const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
    if (!validCode(code)) return json({ error: 'Codice lobby non valido.' }, 400);
    const result = await updateRoom(code, (room) => {
      const member = findMember(room, body.token);
      if (!member) return { error: 'Accesso alla lobby non autorizzato.', status: 403 };
      room.members = room.members.filter((entry) => entry.id !== member.id);
      if (room.members.length === 0) room.closedAt = Date.now();
      return {};
    });
    if (result.error) return json({ error: result.error }, result.status);
    return json({ left: true });
  }

  return json({ error: 'Azione non riconosciuta.' }, 400);
};
