import re

def process_file():
    file_path = r'c:\Users\wbddw\OneDrive\שולחן העבודה\power\style.css'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove duplicate .workout-modal-overlay
    # First match
    first_workout = re.search(r'\.workout-modal-overlay\s*\{[^{}]*\}', content)
    if first_workout:
        first_str = first_workout.group(0)
        # Find all others and remove them
        parts = content.split(first_str, 1)
        if len(parts) == 2:
            remaining = re.sub(r'\.workout-modal-overlay\s*\{[^{}]*\}', '', parts[1])
            content = parts[0] + first_str + remaining

    # 2. Remove duplicate .rest-btn:hover
    first_rest = re.search(r'\.rest-btn:hover\s*\{[^{}]*\}', content)
    if first_rest:
        first_str = first_rest.group(0)
        parts = content.split(first_str, 1)
        if len(parts) == 2:
            remaining = re.sub(r'\.rest-btn:hover\s*\{[^{}]*\}', '', parts[1])
            content = parts[0] + first_str + remaining

    # 3. Consolidate .exercise-card.saved
    # Remove all existing .exercise-card.saved blocks
    content = re.sub(r'\.exercise-card\.saved\s*\{[^{}]*\}', '', content)
    
    # Append the clean definition to the end or replace it in the first occurrence place.
    # We can just put it back at the end of the file.
    clean_exercise_card = """
.exercise-card.saved {
  border-left: 3px solid #16a34a;
  background: rgba(16, 16, 20, 0.95) !important;
  border-top: 1px solid rgba(228, 228, 230, 0.08) !important;
  border-right: 1px solid rgba(228, 228, 230, 0.08) !important;
  border-bottom: 1px solid rgba(228, 228, 230, 0.08) !important;
  box-shadow: none !important;
  transform: translateY(0);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
"""
    content += clean_exercise_card

    # 4. Add missing #stale-workout-modal near other modals
    # Let's find #workout-history-modal or #workout-summary-modal
    stale_modal_css = """
#stale-workout-modal {
  display: flex;
  flex-direction: column;
  background: var(--surface-1);
  border: 1px solid rgba(228, 228, 230, 0.08);
  border-radius: 20px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  z-index: 1300;
  color: var(--text-primary);
  text-align: center;
}
#stale-workout-modal h2 {
  font-size: 1.4rem;
  margin-bottom: 12px;
  color: #fff;
}
#stale-workout-modal p {
  color: var(--text-muted);
  font-size: 0.95rem;
  margin-bottom: 24px;
  line-height: 1.5;
}
#stale-workout-modal .modal-actions {
  display: flex;
  gap: 12px;
  flex-direction: column;
}
"""
    if '#workout-summary-modal' in content:
        content = content.replace('#workout-summary-modal {', stale_modal_css + '\n#workout-summary-modal {')
    else:
        content += stale_modal_css

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    process_file()
