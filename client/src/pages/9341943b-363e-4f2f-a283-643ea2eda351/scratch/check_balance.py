
def check_jsx_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    tags = []
    # Simple regex to find <Tag and </Tag>
    # Note: this is very naive but might help find the obvious
    import re
    
    # Remove strings and comments to avoid false positives
    content = re.sub(r'//.*', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    
    # Find all potential tags
    # This won't be perfect for JSX but let's try
    all_tags = re.findall(r'</?([a-zA-Z0-9.]+)', content)
    
    # We only care about opening/closing pairs that are NOT self-closing
    # Self-closing tags like <input /> are harder with this naive regex
    # But </Tag> is always a closing tag.
    
    # Let's try to track <Parent> ... </Parent>
    stack = []
    lines = content.split('\n')
    for i, line in enumerate(lines):
        # Find all tags in this line
        # Regex for opening tags: <Tag (not starting with /)
        # Regex for closing tags: </Tag
        # Exclude self-closing tags: <Tag ... />
        
        # This is getting complex. Let's just look for { } and ( ) balance first.
        pass

def count_braces(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    curly = 0
    paren = 0
    square = 0
    for i, line in enumerate(lines):
        c_open = line.count('{')
        c_close = line.count('}')
        p_open = line.count('(')
        p_close = line.count(')')
        s_open = line.count('[')
        s_close = line.count(']')
        
        curly += c_open - c_close
        paren += p_open - p_close
        square += s_open - s_close
        
        if curly < 0 or paren < 0 or square < 0:
            print(f"Error at line {i+1}: Negative balance! Curly:{curly}, Paren:{paren}, Square:{square}")
    
    print(f"Final balance: Curly:{curly}, Paren:{paren}, Square:{square}")

if __name__ == "__main__":
    count_braces(r'c:\dev\Sosturer\client\src\pages\Definitions.tsx')
