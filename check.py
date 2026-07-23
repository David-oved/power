import sys

file_path = r'c:\Users\wbddw\OneDrive\שולחן העבודה\power\style.css'
lines_to_check = [
    285, 339, 351, 693, 717, 876, 950, 1198, 1203, 1403, 1906, 1939, 3334, 4181, 4582, 4760, 4991, 5024, 5118, 5397, 5575, 6241, 6252, 6288, 6412, 6527, 6822, 6840, 7014, 7702, 8355, 8387, 8434, 8543, 9008, 9546,
    382, 392, 1153, 4113, 4717, 5126, 6168, 6528, 8003, 8356,
    1196, 3383, 3572, 6505, 6536, 6560, 8400, 8413, 9417, 9483, 9563,
    2404, 3854, 3290, 3478
]

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for line_num in sorted(set(lines_to_check)):
    start = max(0, line_num - 5)
    end = min(len(lines), line_num + 10)
    print(f"--- Around line {line_num} ---")
    for i in range(start, end):
        print(f"{i+1}: {lines[i].rstrip()}")
