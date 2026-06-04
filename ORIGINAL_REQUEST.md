# Original User Request

## Initial Request — 2026-06-04T13:09:07Z

Complete visual and interactive redesign of the workouts tab and active tracking console, transforming the interface into a premium, state-of-the-art mobile training system inspired by iOS 18 and high-end fitness apps.

Working directory: c:\Users\wbddw\OneDrive\שולחן העבודה\power
Integrity mode: development

## Requirements

### R1. ממשק אימון פעיל פרימיום (Premium Active Workout UI)
- עיצוב מחדש של מסך האימון הפעיל (`#workout-active-view`) לממשק נקי ומודרני מבוסס כרטיסיות תרגילים דינמיות.
- כרטיסיות התרגילים יכללו כפתורי סיום, פונקציות הוספת/ביטול סטים מהירות ואנימציות חלקות בעת הוספה או מחיקה.
- התרשים הדינמי בראש המסך יציג את התקדמות האימון הנוכחי באמצעות פס התקדמות זוהר (Lava glow gradient).

### R2. בקרות רישום סטים משופרות (Advanced Weight, Reps & Time Inputs)
- שדרוג מודאל רישום הסטים (`#set-log-modal`) לגיליון תחתון (iOS-style Bottom Sheet) שנפתח ומחליק בצורה חלקה מלמטה.
- שימוש במדדים מותאמים אישית: תמיכה מלאה ברישום מרובה של משקל, חזרות וזמן (זמן נמדד בשניות עם סליידרים ובקרים רספונסיביים).
- סליידרים מעוצבים עם סימונים ויזואליים, כפתורי כיוונון עגולים גדולים המונעים לחיצות שגויות במגע.

### R3. טיימר מנוחה אינטראקטיבי (Interactive Snapping Rest Timer)
- עיצוב בועת טיימר המנוחה כאלמנט צף (Floating Action Bubble) עם השתקפות של זכוכית (Glassmorphic) וצללים ניאוניים זוהרים.
- הטמעת מנגנון גרירה והיצמדות פיזיקלי (Edge-Snapping Physics) המצמיד את הטיימר לשולי המסך במרחק של 16px מהקצוות בעת שחרור.
- הוספת אנימציית טעינה סיבובית המציגה את התקדמות המנוחה בצורה ויזואלית.

### R4. סנכרון לוח בקרה ואנליטיקה (Dashboard & Analytics Sync)
- לוח הבקרה הראשי (`#workout-idle-view`) יציג נתוני אימונים שבועיים וחודשיים בזמן אמת.
- עדכון מסך האנליטיקה והגרפים (`src/metrics/metrics.js`) כדי לתמוך במלואם במדדי זמן (שניות), PR מותאמים אישית לכל מדד, והצגת היסטוריית אימונים מפורטת.
- הבטחה כי כל מאזיני האירועים הקיימים אינם נשברים וכל פונקציונליות השמירה והעדכון של הנתונים פועלת ללא שגיאות קונסול.

## Acceptance Criteria

### נראות וחוויית משתמש (Visual & UX Polish)
- האפליקציה נראית יוקרתית, משתמשת בפונטים מודרניים ובפלטת צבעים כהה ועשירה (Dark Steel + molten red/neon blue gradients).
- הגיליונות והמודאלים מחליקים מלמטה עם מעברי CSS חלקים (Transitions) ב-60 FPS.
- טיימר המנוחה הצף נצמד לצדדים בצורה חלקה בעזרת מאזיני מגע (`touchstart`, `touchmove`, `touchend`) ללא רעידות.
- תצוגת האנליטיקה תומכת במדדי זמן ומציגה גרפים מתאימים ב-Inspector של התרגילים.
- אין שום שגיאות JavaScript בקונסולה בעת ביצוע אימון מלא, הוספת תרגילים או צפייה במדדים.
