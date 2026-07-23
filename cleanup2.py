import re

def main():
    file_path = r'c:\Users\wbddw\OneDrive\שולחן העבודה\power\style.css'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. TEXT-SHADOWS TO REMOVE (set to `none`)
    shadow_classes = [
        r'\.splash-title', r'\.splash-subtitle', r'\.ios-pointing-arrow', r'\.drum-picker-item\.selected', 
        r'\.slider-display-value', r'\.rest-timer-countdown', r'\.workout-log-trend-badge', 
        r'\.coming-soon-badge-glow', r'\.center-cal-value', r'\.inspector-toggle-btn\.active'
    ]
    for cls in shadow_classes:
        content = re.sub(r'(' + cls + r'[^{]*\{[^}]*?)text-shadow:[^;}]+;?', r'\1text-shadow: none;', content)

    # 2. BOX-SHADOWS / DROP-SHADOWS
    # Replace drop-shadow with none
    content = re.sub(r'(\.aura-logo-svg[^{]*\{[^}]*?)filter:\s*drop-shadow[^;]+;?', r'\1filter: none;', content)
    content = re.sub(r'(\.spinner-outer[^{]*\{[^}]*?)filter:\s*drop-shadow[^;]+;?', r'\1filter: none;', content)
    content = re.sub(r'(\.spinner-inner[^{]*\{[^}]*?)filter:\s*drop-shadow[^;]+;?', r'\1filter: none;', content)
    content = re.sub(r'(\.coming-soon-emoji[^{]*\{[^}]*?)filter:\s*drop-shadow[^;]+;?', r'\1filter: none;', content)
    content = re.sub(r'(\.rest-timer-progress-circle[^{]*\{[^}]*?)filter:\s*drop-shadow[^;]+;?', r'\1filter: none;', content)
    content = re.sub(r'(\.bezier-chart-path[^{]*\{[^}]*?)filter:\s*drop-shadow[^;]+;?', r'\1filter: none;', content)
    content = re.sub(r'(\.gauge-progress-arc(\.[a-zA-Z0-9_-]+)?[^{]*\{[^}]*?)filter:\s*drop-shadow[^;]+;?', r'\1filter: none;', content)
    content = re.sub(r'(#exercises-container:empty::before[^{]*\{[^}]*?)filter:\s*drop-shadow[^;]+;?', r'\1filter: none !important;', content)

    # Replace box-shadows with none or subtle dark shadow
    def replace_box_shadow(pattern, replacement):
        nonlocal content
        content = re.sub(r'(' + pattern + r'[^{]*\{[^}]*?)box-shadow:[^;}]+;?', r'\1box-shadow: ' + replacement + ';', content)

    replace_box_shadow(r'\.btn-primary', 'none')
    replace_box_shadow(r'\.btn-success', 'none')
    replace_box_shadow(r'\.btn-logout', 'none')
    replace_box_shadow(r'\.active-status-dot', 'none')
    replace_box_shadow(r'\.status-dot', 'none')
    replace_box_shadow(r'\.toast-refresh-btn:hover', 'none')
    replace_box_shadow(r'\.ios-bottom-nav\.collapsed', '0 2px 8px rgba(0, 0, 0, 0.3)')
    replace_box_shadow(r'\.badge-soon', 'none')
    replace_box_shadow(r'\.premium-toast', '0 2px 8px rgba(0, 0, 0, 0.3)')
    replace_box_shadow(r'\.premium-toast\.error-toast', '0 2px 8px rgba(0, 0, 0, 0.3)')
    replace_box_shadow(r'\.premium-toast\.success-toast', '0 2px 8px rgba(0, 0, 0, 0.3)')
    replace_box_shadow(r'\.set-entry-confirm-btn', 'none')
    replace_box_shadow(r'\.muscle-card\.active', 'none')
    # For muscle-card active, ensure thin border
    content = re.sub(r'(\.muscle-card\.active[^{]*\{[^}]*?)border:[^;}]+;?', r'\1border: 1px solid rgba(228, 228, 230, 0.15);', content)
    
    replace_box_shadow(r'\.premium-range-slider::-webkit-slider-thumb', '0 2px 8px rgba(0,0,0,0.3)')
    replace_box_shadow(r'\.ex-fav-star-btn:hover', 'none')
    replace_box_shadow(r'\.ex-fav-star-btn:active', 'none')
    replace_box_shadow(r'#save-custom-exercise-btn', 'none')
    replace_box_shadow(r'\.workout-dot-indicator', 'none')
    replace_box_shadow(r'\.calendar-day-cell\.has-future-workout', 'none')
    replace_box_shadow(r'\.future-workout-dot-indicator', 'none')
    replace_box_shadow(r'\.schedule-trigger-btn:hover', 'none')
    replace_box_shadow(r'\.coming-soon-badge-glow', 'none')
    replace_box_shadow(r'\.calendar-day-cell\.today', 'none')
    replace_box_shadow(r'\.workout-dot', 'none')
    replace_box_shadow(r'\.meals-indicator-dot', 'none')
    replace_box_shadow(r'\.inspector-toggle-btn\.active', 'none')
    replace_box_shadow(r'#add-exercise-btn', 'none !important')
    replace_box_shadow(r'\.exercise-card::after', 'none !important')
    replace_box_shadow(r'\.set-dot\.completed', 'none !important')
    replace_box_shadow(r'\.gps-pulse-marker', 'none')

    # Remove all box-shadow for any variants like .workout-dot.upper, etc.
    content = re.sub(r'(\.workout-dot\.[a-zA-Z0-9_-]+[^{]*\{[^}]*?)box-shadow:[^;}]+;?', r'\1box-shadow: none;', content)
    
    # Remove animation properties referencing specific keyframes
    anim_names = ['pulse-spark', 'pulse-danger-border', 'pulse-danger-glow', 'orb-pulsate', 'badge-glow-pulse', 
                  'ai-ripple-effect', 'empty-glow-pulse', 'pulse-glow', 'pulse-dot', 
                  'run-pulse-glow', 'walk-pulse-glow', 'rest-pulse-glow', 'gps-dot-pulse']
    
    for anim in anim_names:
        # Remove the animation property
        content = re.sub(r'animation:\s*' + anim + r'[^;]+;?', r'', content)
        # Remove the keyframes definition entirely
        content = re.sub(r'@keyframes\s+' + anim + r'\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', r'', content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    main()
