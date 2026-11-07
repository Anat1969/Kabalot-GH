#!/usr/bin/env python3
"""Turns the Gmail extraction (gmail.json) into app receipts (items.json), converting foreign
charges with the Bank of Israel representative rate of the charge date (usd.csv / eur.csv, SDMX CSV).
Usage: python3 -I to-items.py gmail.json usd.csv items.json [eur.csv]"""
import csv, json, sys

TOPIC = {'בינה מלאכותית': 'בינה מלאכותית', 'פיתוח ותשתיות': 'פיתוח ותשתיות', 'תקשורת וגלישה': 'תקשורת וגלישה',
         'בריאות': 'בריאות ויופי', 'אחר': 'אחר'}

def rates(path):
    out = []
    if not path: return out
    with open(path, encoding='utf-8') as f:
        for row in csv.DictReader(f):
            if row.get('TIME_PERIOD') and row.get('OBS_VALUE'): out.append((row['TIME_PERIOD'], float(row['OBS_VALUE'])))
    return sorted(out)

def rate_on(table, date):
    best = None
    for d, v in table:
        if d <= date: best = (d, v)
    return best

def main(src, usd, dst, eur=None):
    tables = {'USD': rates(usd), 'EUR': rates(eur)}
    items = []
    for x in json.load(open(src, encoding='utf-8')):
        cur = x.get('currency') or 'ILS'
        it = {
            'sourceId': 'gmail:' + x['messageId'], 'date': x['date'], 'item': x['item'], 'store': x['vendor'],
            'category': TOPIC.get(x.get('topic'), 'אחר'), 'kind': x.get('kind', 'one-time'), 'currency': cur,
            'link': x.get('viewUrl', ''), 'text': x.get('text', ''),
            'notes': ' · '.join(p for p in [x.get('ref') and f"אסמכתא {x['ref']}", x.get('period'), x.get('note')] if p),
        }
        if cur == 'ILS':
            it['amount'] = x.get('amount')
        else:
            it['amountOrig'] = x.get('amount')
            r = rate_on(tables.get(cur, []), x['date'])
            if r and x.get('amount') is not None:
                it['rateDate'], it['rate'] = r
                it['amount'] = round(x['amount'] * r[1], 2)
            else:
                it['amount'] = None
        items.append(it)
    json.dump(items, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(items), 'items')

if __name__ == '__main__':
    main(*sys.argv[1:])
