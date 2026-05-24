const fs = require('fs');
const css = fs.readFileSync('c:\\\\Users\\\\wbddw\\\\OneDrive\\\\שולחן העבודה\\\\power\\\\style.css', 'utf8');

const lines = css.split('\n');
lines.forEach((line, i) => {
  if (line.includes('bottom-nav-bar')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
});
