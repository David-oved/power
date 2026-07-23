import re

def process_css(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    # We will do line-by-line or block replacements to be safe.
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)

if __name__ == '__main__':
    process_css(r'c:\Users\wbddw\OneDrive\שולחן העבודה\power\style.css')
