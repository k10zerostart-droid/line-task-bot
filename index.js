const express = require('express');
const { Client } = require('@line/bot-sdk');
const https = require('https');

const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
};

const client = new Client(config);
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const app = express();

function notionRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.notion.com',
      path: '/v1/' + path,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + NOTION_TOKEN,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.status && parsed.status >= 400) {
          reject(new Error(parsed.message));
        } else {
          resolve(parsed);
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;
  const text = event.message.text.trim();

  try {
    if (text.startsWith('追加 ')) {
      const task = text.replace('追加 ', '');
      await notionRequest('POST', 'pages', {
        parent: { database_id: DATABASE_ID },
        properties: {
          名前: { title: [{ text: { content: task } }] },
          完了: { checkbox: false },
        },
      });
      return client.replyMessage(event.replyToken, { type: 'text', text: '✅ 追加: ' + task });
    }

    if (text === '一覧') {
      const res = await notionRequest('POST', 'databases/' + DATABASE_ID + '/query', {});
      const tasks = res.results;
      if (tasks.length === 0) return client.replyMessage(event.replyToken, { type: 'text', text: 'タスクはありません' });
      const list = tasks.map((t, i) => {
        const done = t.properties.完了.checkbox;
        const name = t.properties.名前.title[0]?.plain_text;
        return (i + 1) + '. ' + (done ? '✅' : '☐') + ' ' + name;
      }).join('\n');
      return client.replyMessage(event.replyToken, { type: 'text', text: list });
    }

    if (text.startsWith('完了 ')) {
      const num = parseInt(text.replace('完了 ', '')) - 1;
      const res = await notionRequest('POST', 'databases/' + DATABASE_ID + '/query', {});
      const task = res.results[num];
      if (!task) return client.replyMessage(event.replyToken, { type: 'text', text: '番号が見つかりません' });
      await notionRequest('PATCH', 'pages/' + task.id, { properties: { 完了: { checkbox: true } } });
      return client.replyMessage(event.replyToken, { type: 'text', text: '✅ 完了しました' });
    }

    if (text.startsWith('削除 ')) {
      const num = parseInt(text.replace('削除 ', '')) - 1;
      const res = await notionRequest('POST', 'databases/' + DATABASE_ID + '/query', {});
      const task = res.results[num];
      if (!task) return client.replyMessage(event.replyToken, { type: 'text', text: '番号が見つかりません' });
      await notionRequest('PATCH', 'pages/' + task.id, { properties: { 完了: { checkbox: true } } });
      return client.replyMessage(event.replyToken, { type: 'text', text: '🗑️ 削除: ' + task.properties.名前.title[0]?.plain_text });
    }

    return client.replyMessage(event.replyToken, { type: 'text', text: '使い方:\n追加 タスク名\n一覧\n完了 番号\n削除 番号' });

  } catch (err) {
    console.error('エラー:', err.message);
    return client.replyMessage(event.replyToken, { type: 'text', text: 'エラー: ' + err.message });
  }
}

app.post('/webhook', express.json(), (req, res) => {
  res.json({ status: 'ok' });
  const events = req.body.events;
  if (events) events.forEach(handleEvent);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server running on port ' + port));
