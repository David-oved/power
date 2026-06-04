import json
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')

def show_tail(conversation_id, name):
    path = f"C:/Users/wbddw/.gemini/antigravity/brain/{conversation_id}/.system_generated/logs/transcript.jsonl"
    print(f"=== {name} ({conversation_id}) ===")
    if not os.path.exists(path):
        print("Transcript file does not exist yet.")
        return
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    print(f"Total steps: {len(lines)}")
    # Print the last 5 steps types and summaries
    for line in lines[-5:]:
        try:
            obj = json.loads(line)
            print(f"Step {obj.get('step_index')}: {obj.get('source')} - {obj.get('type')} - status={obj.get('status')}")
            # Try to show snippet of content or tool calls
            content = obj.get('content', '')
            if content:
                print(f"  Content: {content[:100]}...")
            tool_calls = obj.get('tool_calls', [])
            if tool_calls:
                for tc in tool_calls:
                    print(f"  Tool Call: {tc.get('name')} with target {tc.get('parameters', {}).get('TargetFile') or tc.get('parameters', {}).get('CommandLine')}")
        except Exception as e:
            print("  Failed to parse line:", e)

show_tail("96a2aa5b-9402-4173-b56a-93459aa7d6ee", "UI DESIGNER")
show_tail("4bc0fef5-ac0c-4f91-8160-510e580a9da8", "LOGIC DEVELOPER")
