const express = require('express');
const { Client } = require('@line/bot-sdk');

const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
};

const client = new Client(config);
const app = express();

const tasks = [];

app.post('/webhook', express.json(), (req, res) => {
  res.json({ status: 'ok' });
  const events = req.body.events;
  if (events) events.forEach(handleEvent);
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;
  const text = event.message.text.trim();

  if (text.startsWith('追加 ')) {
    const task = text.replace('追加 ', '');
    tasks.push({ task, done: false });
    return client.replyMessage(event.replyToken, { type: 'text', text: `✅ 追加しました: ${task}` });
  }
  if (text === '一覧') {
    if (tasks.length === 0) return client.replyMessage(event.replyToken, { type: 'text', text: 'タスクはありません' });
    const list = tasks.map((t, i) => `${i + 1}. ${t.done ? '✅' : '⬜'} ${t.task}`).join('\n');
    return client.replyMessage(event.replyToken, { type: 'text', text: list });
  }
  if (text.startsWith('完了 ')) {
    const num = parseInt(text.replace('完了 ', '')) - 1;
    if (tasks[num]) { tasks[num].done = true; return client.replyMessage(event.replyToken, { type: 'text', text: `✅ 完了: ${tasks[num].task}` }); }
  }
  if (text.startsWith('削除 ')) {
    const num = parseInt(text.replace('削除 ', '')) - 1;
    if (tasks[num]) { const removed = tasks.splice(num, 1); return client.replyMessage(event.replyToken, { type: 'text', text: `🗑️ 削除: ${removed[0].task}` }); }
  }
  return client.replyMessage(event.replyToken, { type: 'text', text: '使い方:\n追加 タスク名\n一覧\n完了 番号\n削除 番号' });
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
