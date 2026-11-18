"""Placement and road grades for the western market and southern workshops."""

MARKET = [
    ('caravan-watch', 'Strażnica Karawan', 'watch', [-258, -55], [12, 10], 34),
    ('caravan-inn', 'Gospoda Karawan', 'inn', [-224, -61], [22, 18], 28),
    ('spice-arcade', 'Podcienia Korzenne', 'arcade', [-179, -55], [17, 9], 18),
    ('cloth-shop', 'Skład Sukna', 'shop', [-153, -26], [20, 18], 15),
    ('market-house', 'Dom Przyjezdnych', 'home', [-247, 17], [12, 10], 30),
]
FORGES = [
    ('coal-depot', 'Skład Węgla', 'depot', [-115, 154], [22, 18], 10),
    ('lower-smithy', 'Kuźnia Dolna', 'smithy', [-50, 174], [24, 18], 6),
    ('metal-house', 'Dom Odlewników', 'home', [14, 168], [12, 10], 8),
    ('foundry', 'Odlewnia', 'smithy', [57, 216], [24, 18], 10),
    ('forge-hall', 'Skład Sztab', 'depot', [-66, 242], [22, 18], 4),
]
QUARTER_STREETS = [
    ('Trakt Bramy', 12, [[-78,-7],[-111,-9],[-144,-4],[-179,-15],[-200,-28],[-217,-34],[-238,-30],[-251,-42]],
     [12,14,15.5,16,21,25,30,34]),
    ('Zaułek Karawan', 7, [[-179,-15],[-182,5],[-195,22],[-215,18],[-231,1],[-238,-30]],
     [16,16,19,22,26,30]),
    ('Obwód Kuźni', 11, [[-90,165],[-98,205],[-76,218],[-43,206],[-10,197],[40,194],[74,174],[86,144],[74,76]],
     [7,4,3,3,6,8,11,11,12]),
    ('Zaułek Węglowy', 7, [[-76,218],[-62,222],[-40,222],[-14,214],[-10,197]],
     [3,3,3,4,6]),
]
QUARTER_COURTS = [
    ('Targ Żarowej Bramy', [[-238,-39],[-225,-47],[-208,-47],[-198,-35],[-203,-23],[-220,-19],[-237,-25]],
     [-217,-34], [22,12], 25),
    ('Plac Węglowy', [[-64,200],[-54,194],[-36,193],[-24,198],[-24,213],[-39,219],[-62,217]],
     [-44,207], [19,10], 3),
]
QUARTER_LAMPS = [[-205,-39],[-224,-22],[-167,-8],[-62,195],[-29,214],[47,184]]
QUARTER_GROVES = [[-155,9],[-203,33],[-189,37],[-248,-22],[-221,-51],[-82,231],[23,208],[43,175]]
QUARTER_MARKERS = [
    {'name': 'Plac Koronny', 'center': [-65,-159], 'radii': [89,82]},
    {'name': 'Targ Bramny', 'center': [-188,-25], 'radii': [92,82]},
    {'name': 'Dolne Kuźnie', 'center': [-22,196], 'radii': [134,69]},
]
PATROLS = [
    {'id': 'caravan', 'name': 'Tragarz', 'street': 'Zaułek Karawan', 'tint': 'e2b38a', 'speed': 3.2},
    {'id': 'market', 'name': 'Targowa straż', 'street': 'Trakt Bramy', 'tint': 'd4c3b4', 'speed': 3.8},
    {'id': 'coal', 'name': 'Pomocnik kuźni', 'street': 'Zaułek Węglowy', 'tint': 'c4a9a3', 'speed': 2.8},
]
