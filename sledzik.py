import requests
import json
import os
import re
from datetime import datetime

PLAYERS = {
    "Brahmaparuss": "https://s60-pl.bitefight.gameforge.com/profile/player/2504867",
    "Gawron": "https://s60-pl.bitefight.gameforge.com/profile/player/2505390",
    "lux": "https://s60-pl.bitefight.gameforge.com/profile/player/434236",
    "XTurek": "https://s60-pl.bitefight.gameforge.com/profile/player/416953",
    "Viktor": "https://s60-pl.bitefight.gameforge.com/profile/player/2509906",
    "PEON": "https://s60-pl.bitefight.gameforge.com/profile/player/1532448"
}

STATE_FILE = "baza_danych_graczy.json"

def get_today_report_filename():
    today = datetime.now().strftime("%d.%m.%Y")
    return f"Raport_Bitefight_{today}.csv"

def parse_value(val_str):
    num_str = str(val_str).split('/')[0]
    num_str = re.sub(r'[^0-9-]', '', num_str)
    try:
        return int(num_str)
    except ValueError:
        return None

def parse_html(html_string):
    stats = {}
    
    def extract(pattern):
        match = re.search(pattern, html_string, re.DOTALL | re.IGNORECASE)
        return match.group(1).strip() if match else None

    exp = extract(r'Doświadczenie:.*?<span class="fontsmall">\s*\((.*?)\)</span>')
    if exp: stats["Doswiadczenie"] = exp

    attr_map = {
        "Siła": "Sila", "Obrona": "Obrona", "Zwinność": "Zwinnosc",
        "Wytrzymałość": "Wytrzymalosc", "Charyzma": "Charyzma"
    }
    for pl_name, safe_name in attr_map.items():
        val = extract(fr'{pl_name}:.*?<span class="fontsmall">\((.*?)\)</span>')
        if val: stats[safe_name] = val

    for gen in ["Walki", "Zrabowane dobra"]:
        val = extract(fr'<strong>{gen}:</strong>.*?<td class="tdn">(.*?)</td>')
        if val: stats[gen] = val

    return stats

def log_change(player, stat_name, old_val, new_val, diff_str):
    file_name = get_today_report_filename()
    file_exists = os.path.exists(file_name)
    timestamp = datetime.now().strftime('%d.%m.%Y, %H:%M:%S')
    
    with open(file_name, "a", encoding="utf-8-sig") as f:
        if not file_exists:
            f.write("Data i godzina;Gracz;Statystyka;Stara wartosc;Nowa wartosc;Przyrost\n")
        f.write(f"{timestamp};{player};{stat_name};{old_val};{new_val};{diff_str}\n")

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_state(state):
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=4)

def check_all_players():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Sprawdzam statystyki...")
    current_data = load_state()
    new_data = {}
    changes_detected = False

    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

    for name, url in PLAYERS.items():
        try:
            response = requests.get(url, headers=headers, timeout=10)
            stats = parse_html(response.text)
            new_data[name] = stats

            if name in current_data:
                for key, new_val in stats.items():
                    old_val = current_data[name].get(key)
                    if old_val and old_val != new_val:
                        changes_detected = True
                        old_num = parse_value(old_val)
                        new_num = parse_value(new_val)
                        diff_str = ""
                        
                        if old_num is not None and new_num is not None:
                            diff_str = str(new_num - old_num)
                        
                        print(f" [+] {name} | {key} | Przyrost: {diff_str}")
                        log_change(name, key, old_val, new_val, diff_str)
        except Exception as e:
            print(f" [!] Błąd pobierania gracza {name}: {e}")
            new_data[name] = current_data.get(name, {})

    save_state(new_data)
    if not changes_detected:
        print(" [-] Brak zmian od ostatniego sprawdzenia.")

if __name__ == "__main__":
    check_all_players()