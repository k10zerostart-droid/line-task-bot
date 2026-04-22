console.log('NOTION_TOKEN:', process.env.NOTION_TOKEN ? '読めてる' : '読めていない');
const express = require('express');
const { Client } = require('@line/bot-sdk');
const { Client: NotionClient } = require('@notionhq/client');

const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
};

const client = new Client(config);
const notion = new NotionClient({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const app = express();

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
    await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties: {
        名前: { title: [{ text: { content: task } }] },
        完了: { checkbox: false },
      },
    });
    return client.replyMessage(event.replyToken, { type: 'text', text: `✅ 追加しました: ${task}` });
  }

  if (text === '一覧') {
    const res = await notion.databases.query({ database_id: DATABASE_ID });
    const tasks = res.results;
    if (tasks.length === 0) return client.replyMessage(event.replyToken, { type: 'text', text: 'タスクはありません' });
    const list = tasks.map((t, i) => {
      const done = t.properties.完了.checkbox;
      const name = t.properties.名前.title[0]?.plain_text || '';
      return `${i + 1}. ${done ? '✅' : '⬜'} ${name}`;
    }).join('\n');
    return client.replyMessage(event.replyToken, { type: 'text', text: list });
  }

  if (text.startsWith('完了 ')) {
    const num = parseInt(text.replace('完了 ', '')) - 1;
    const res = await notion.databases.query({ database_id: DATABASE_ID });
    const task = res.results[num];
    if (!task) return client.replyMessage(event.replyToken, { type: 'text', text: '番号が正しくありません' });
    await notion.pages.update({ page_id: task.id, properties: { 完了: { checkbox: true } } });
    return client.replyMessage(event.replyToken, { type: 'text', text: '✅ 完了しました！' });
  }

  if (text.startsWith('削除 ')) {
    const num = parseInt(text.replace('削除 ', '')) - 1;
    const res = await notion.databases.query({ database_id: DATABASE_ID });
    const task = res.results[num];
    if (!task) return client.replyMessage(event.replyToken, { type: 'text', text: '番号が正しくありません' });
    await notion.pages.update({ page_id: task.id, properties: { 完了: { checkbox: true } } });
    return client.replyMessage(event.replyToken, { type: 'text', text: '🗑️ 削除しました！' });
  }

  return client.replyMessage(event.replyToken, { type: 'text', text: '使い方:\n追加 タスク名\n一覧\n完了 番号\n削除 番号' });
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
