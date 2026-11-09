/**
 * PROJECT OMNIKNOW - Cloudflare Worker
 * 초기 MVP: Topic CRUD API + Static Frontend Serving
 * 나중에 에이전트, 검증, 스케줄러 등을 확장할 수 있도록 구조화
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS 헤더 (로컬 개발용, 실제 배포 시에는 같은 원신)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // API 라우트
      if (path.startsWith('/api/')) {
        const response = await handleApi(request, env, path);
        // CORS 적용
        const newHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
        return new Response(response.body, {
          status: response.status,
          headers: newHeaders,
        });
      }

      // Static assets (index.html 등)
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error', message: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },
};

/**
 * API 라우터
 */
async function handleApi(request, env, path) {
  const method = request.method;

  // Health check
  if (path === '/api/health' && method === 'GET') {
    return json({ ok: true, backend: 'running', database: 'connected', timestamp: new Date().toISOString() });
  }

  // Topics CRUD
  if (path === '/api/topics' && method === 'GET') {
    return await listTopics(env);
  }
  if (path === '/api/topics' && method === 'POST') {
    return await createTopic(request, env);
  }

  // /api/topics/:id
  const topicMatch = path.match(/^\/api\/topics\/(\d+)$/);
  if (topicMatch) {
    const id = parseInt(topicMatch[1], 10);
    if (method === 'GET') return await getTopic(env, id);
    if (method === 'PATCH') return await updateTopic(request, env, id);
    if (method === 'DELETE') return await deleteTopic(env, id);
  }

  return json({ error: 'Not Found' }, 404);
}

// 도움말 함수들
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function listTopics(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM topics ORDER BY priority DESC, created_at DESC'
  ).all();
  return json({ count: results.length, topics: results });
}

async function getTopic(env, id) {
  const topic = await env.DB.prepare('SELECT * FROM topics WHERE id = ?').bind(id).first();
  if (!topic) return json({ error: 'Topic not found' }, 404);
  return json(topic);
}

async function createTopic(request, env) {
  const body = await request.json().catch(() => ({}));
  const { title, category = 'general', priority = 3, notes = '' } = body;

  // 입력 검증
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return json({ error: 'title is required and must be a non-empty string' }, 400);
  }
  if (priority !== undefined && (typeof priority !== 'number' || priority < 1 || priority > 5)) {
    return json({ error: 'priority must be an integer between 1 and 5' }, 400);
  }

  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO topics (title, category, priority, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(title.trim(), category, priority, notes, now, now).run();

  return json({ id: result.meta.last_row_id, message: 'Topic created' }, 201);
}

async function updateTopic(request, env, id) {
  const body = await request.json().catch(() => ({}));
  const { title, category, priority, status, notes } = body;

  // 존재 확인
  const existing = await env.DB.prepare('SELECT id FROM topics WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'Topic not found' }, 404);

  // 유효성 검증
  if (status && !['pending', 'researching', 'completed'].includes(status)) {
    return json({ error: 'status must be one of: pending, researching, completed' }, 400);
  }
  if (priority !== undefined && (typeof priority !== 'number' || priority < 1 || priority > 5)) {
    return json({ error: 'priority must be an integer between 1 and 5' }, 400);
  }

  const updates = [];
  const values = [];
  if (title !== undefined) { updates.push('title = ?'); values.push(title.trim()); }
  if (category !== undefined) { updates.push('category = ?'); values.push(category); }
  if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
  if (status !== undefined) { updates.push('status = ?'); values.push(status); }
  if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }

  if (updates.length === 0) {
    return json({ error: 'No valid fields to update' }, 400);
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  await env.DB.prepare(
    `UPDATE topics SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  return json({ message: 'Topic updated', id });
}

async function deleteTopic(env, id) {
  const result = await env.DB.prepare('DELETE FROM topics WHERE id = ?').bind(id).run();
  if (result.meta.changes === 0) {
    return json({ error: 'Topic not found' }, 404);
  }
  return json({ message: 'Topic deleted', id });
}
