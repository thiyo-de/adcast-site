import fs from 'fs';

const raw = fs.readFileSync('C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\1b75adf3-086e-4f84-b671-c6708787a596\\.system_generated\\steps\\6955\\content.md', 'utf8');
const posts = JSON.parse(raw.slice(raw.indexOf('[')));

posts.forEach((p, idx) => {
  console.log(`${idx + 1}. [${p.id}] "${p.title.rendered}" -> ${p.link}`);
});
