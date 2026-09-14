from data_factory_v2 import build_tasks, balanced_pilot
rows = build_tasks()
pilot = balanced_pilot(rows, 100)
print(len(rows), len(pilot))
