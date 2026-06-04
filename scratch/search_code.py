import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

def search_file(filepath, pattern):
    print(f"=== SEARCHING {filepath} ===")
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    lines = content.splitlines()
    for idx, line in enumerate(lines):
        if re.search(pattern, line, re.IGNORECASE):
            print(f"Line {idx+1}: {line.strip()}")

search_file("c:/Users/wbddw/OneDrive/שולחן העבודה/power/style.css", r"ex-fav-star-btn")
