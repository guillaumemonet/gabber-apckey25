"""Synthèse de sons hardcore / gabber (aucun échantillon externe : libres de droits).

Kicks Rotterdam distordus, hoovers, stabs rave, screeches, percussions, effets
et boucles calées au tempo. Tonalité : fa mineur.
"""
import numpy as np

SR = 44100
rng = np.random.default_rng(190)


# ---------------------------------------------------------------- utilitaires

def t_of(dur):
    return np.arange(int(dur * SR)) / SR


def hz(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def normalize(x, peak=0.89):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def fade(x, fin=0.0005, fout=0.01):
    x = x.copy()
    a, b = min(len(x), int(fin * SR)), min(len(x), int(fout * SR))
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def _coefs(kind, f, q=0.707, gain_db=0.0):
    """Coefficients biquad (RBJ Audio EQ Cookbook)."""
    f = min(max(f, 10.0), SR * 0.45)
    w = 2 * np.pi * f / SR
    cw, sw = np.cos(w), np.sin(w)
    alpha = sw / (2 * q)
    if kind == 'lp':
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'hp':
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'bp':
        b = [alpha, 0, -alpha]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    else:  # 'peak'
        A = 10 ** (gain_db / 40)
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    return np.array(b) / a[0], np.array(a) / a[0]


def biquad(x, kind, f, q=0.707, gain_db=0.0):
    b, a = _coefs(kind, f, q, gain_db)
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    b0, b1, b2 = b
    _, a1, a2 = a
    for i, v in enumerate(x):
        o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, v, y1, o
        y[i] = o
    return y


def sweep(x, kind, freqs, q=0.707, block=32):
    """Filtre dont la fréquence suit le tableau `freqs` (même longueur que x)."""
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for s in range(0, len(x), block):
        b, a = _coefs(kind, float(freqs[s]), q)
        b0, b1, b2 = b
        _, a1, a2 = a
        for i in range(s, min(s + block, len(x))):
            v = x[i]
            o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
            x2, x1, y2, y1 = x1, v, y1, o
            y[i] = o
    return y


def _blep(phase, dt):
    out = np.zeros_like(phase)
    m = phase < dt
    p = phase[m] / dt[m]
    out[m] = p + p - p * p - 1
    m2 = phase > 1 - dt
    p = (phase[m2] - 1) / dt[m2]
    out[m2] = p * p + p + p + 1
    return out


def saw(freq, n=None, phase0=None):
    freq = np.broadcast_to(np.asarray(freq, dtype=float), (n,)) if n else np.asarray(freq, dtype=float)
    dt = np.clip(freq / SR, 1e-6, 0.49)
    phase = (np.cumsum(dt) + (rng.random() if phase0 is None else phase0)) % 1.0
    return 2 * phase - 1 - _blep(phase, dt)


def pulse(freq, width, n):
    freq = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    ph0 = rng.random()
    a = saw(freq, phase0=ph0)
    shifted = saw(freq, phase0=(ph0 + np.mean(width)) % 1.0)
    return (a - shifted) * 0.5


def sine_sweep(freqs):
    return np.sin(2 * np.pi * np.cumsum(freqs) / SR)


def noise(n):
    return rng.uniform(-1, 1, n)


def exp_env(t, decay, hold=0.0):
    return np.where(t < hold, 1.0, np.exp(-(t - hold) / decay))


def adsr(n, a, d, s, r, dur_hold=None):
    t = np.arange(n) / SR
    hold_end = dur_hold if dur_hold is not None else n / SR - r
    env = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = t > hold_end
    env[rel] = env[np.argmax(rel) - 1 if rel.any() else 0] * np.exp(-(t[rel] - hold_end) / max(r / 4, 1e-4))
    return env


def reverb(x, seconds=1.2, mix=0.25):
    n = int(seconds * SR)
    ir = noise(n) * np.exp(-np.arange(n) / (n / 5))
    ir = biquad(ir, 'lp', 6000)
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x) + n]
    wet = normalize(wet, np.max(np.abs(x)) or 1)
    out = np.concatenate([x, np.zeros(n)])
    return out * (1 - mix) + wet * mix


def chorus(x, depth_ms=6, rate=0.6, voices=2):
    n = np.arange(len(x))
    out = x.copy()
    for k in range(voices):
        d = (depth_ms / 2) * (1 + np.sin(2 * np.pi * rate * n / SR + k * np.pi)) * SR / 1000 + 5
        out += np.interp(n - d, n, x, left=0) * 0.7
    return out / (1 + 0.7 * voices)


# ---------------------------------------------------------------- kicks

def gabber_kick(note=41, drive=30, decay=0.28, tail=0.55, punch=260, lp=6500, mid_db=6,
                click=0.6, asym=0.25, dur=0.75, crush=0):
    """Kick 909 saturé : balayage de hauteur puis distorsion massive."""
    t = t_of(dur)
    f0 = hz(note)
    freqs = f0 + (punch - f0) * np.exp(-t / 0.028) + 900 * np.exp(-t / 0.0025) * click
    body = sine_sweep(freqs) * exp_env(t, decay, hold=0.01)
    body += noise(len(t)) * np.exp(-t / 0.003) * 0.3 * click
    x = biquad(body, 'peak', 180, 1.0, 6)
    x = np.tanh(drive * x + asym)                 # saturation asymétrique
    x = np.tanh(2.5 * (x - np.tanh(asym)))
    if crush:
        x = np.round(x * crush) / crush
    x = biquad(x, 'peak', 1300, 0.9, mid_db)      # le « buzz » médium
    x = biquad(x, 'lp', lp, 0.8)
    x = biquad(x, 'hp', 28)
    x *= exp_env(t, tail, hold=0.06)               # la queue qui « ronfle »
    return fade(normalize(x), fout=0.03)


def reverse_kick(note=41):
    k = gabber_kick(note, drive=35, dur=0.5, tail=0.35)
    tailpart = k[int(0.03 * SR):][::-1]
    punch = gabber_kick(note, drive=40, decay=0.08, tail=0.1, dur=0.18)
    return normalize(np.concatenate([tailpart * np.linspace(0.2, 1, len(tailpart)), punch]))


def frenchcore_kick(note=43):
    """Attaque sèche (« tok ») suivie d'une queue tonale."""
    t = t_of(0.6)
    tok = gabber_kick(note + 12, drive=45, decay=0.03, tail=0.05, dur=0.6, lp=9000)
    tail_f = hz(note) * (1 + 0.5 * np.exp(-t / 0.08))
    tail = np.tanh(8 * sine_sweep(tail_f) * exp_env(t, 0.3, 0.05)) * np.clip((t - 0.02) / 0.02, 0, 1)
    tail = biquad(tail, 'lp', 3500)
    return fade(normalize(tok + 0.8 * tail), fout=0.03)


# ---------------------------------------------------------------- percussions

def metal(n, base=40):
    t = np.arange(n) / SR
    x = sum(np.sign(np.sin(2 * np.pi * base * r * t)) for r in (2, 3, 4.16, 5.43, 6.79, 8.21))
    return biquad(biquad(x, 'bp', 10000, 0.8), 'hp', 7000)


def hat(dur=0.08, drive=2.0):
    t = t_of(dur + 0.02)
    x = (metal(len(t)) + 0.5 * biquad(noise(len(t)), 'hp', 8000)) * exp_env(t, dur / 4)
    return fade(normalize(np.tanh(drive * x)))


def ride():
    t = t_of(1.4)
    x = metal(len(t), 52) * exp_env(t, 0.35) + biquad(noise(len(t)), 'bp', 6000, 2) * exp_env(t, 0.5) * 0.4
    return fade(normalize(x))


def crash():
    t = t_of(2.2)
    x = metal(len(t), 47) * exp_env(t, 0.6) + biquad(noise(len(t)), 'hp', 3500) * exp_env(t, 0.7)
    return fade(normalize(np.tanh(1.5 * x)), fout=0.2)


def snare(drive=4):
    t = t_of(0.3)
    tone = sine_sweep(190 + 60 * np.exp(-t / 0.02)) * exp_env(t, 0.06)
    nz = biquad(noise(len(t)), 'hp', 1500) * exp_env(t, 0.09)
    return fade(normalize(np.tanh(drive * (tone * 0.8 + nz))))


def clap(drive=3):
    t = t_of(0.35)
    env = np.zeros_like(t)
    for s in (0, 0.011, 0.022, 0.031):
        env = np.maximum(env, np.where(t >= s, np.exp(-(t - s) / 0.006), 0))
    env = np.maximum(env, np.where(t >= 0.031, np.exp(-(t - 0.031) / 0.09), 0))
    x = biquad(noise(len(t)), 'bp', 1300, 1.3) * env
    return fade(normalize(np.tanh(drive * x)))


def rim():
    t = t_of(0.08)
    x = biquad(np.sign(np.sin(2 * np.pi * 850 * t)), 'bp', 1800, 3) * exp_env(t, 0.012)
    return fade(normalize(x))


# ---------------------------------------------------------------- synthés

def hoover(note, dur=1.1, bend=True):
    """Hoover façon Alpha Juno : scies désaccordées, PWM, chorus, glissé d'attaque."""
    n = int((dur + 0.3) * SR)
    t = np.arange(n) / SR
    glide = -7 * np.exp(-t / 0.06) if bend else 0
    wob = 0.25 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.25) / 0.3, 0, 1)
    x = np.zeros(n)
    for cents in (-28, -14, -5, 0, 6, 15, 27):
        x += saw(hz(note + glide + wob + cents / 100), n)
    x += 0.8 * saw(hz(note - 12 + glide), n)
    x += 0.6 * pulse(hz(note + glide), 0.3, n)
    x = chorus(x / 8, depth_ms=8, rate=0.9)
    x = biquad(x, 'lp', 4200, 0.9)
    x = np.tanh(1.8 * x)
    x *= adsr(n, 0.01, 0.4, 0.85, 0.3, dur)
    return fade(normalize(x))


def stab(notes, dur=0.55, drive=2.5, verb=0.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for nt in notes:
        for c in (-12, 0, 11):
            x += saw(hz(nt + c / 100), n)
        x += 0.5 * pulse(hz(nt - 12), 0.5, n)
    x = sweep(x / len(notes), 'lp', 600 + 7000 * np.exp(-t / 0.08), 2.0)
    x = np.tanh(drive * x) * exp_env(t, 0.18, 0.02)
    return fade(normalize(reverb(fade(x), 1.0, verb)), fout=0.1)


def screech(note, dur=1.0, rate=7):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(note) * (1 + 0.03 * np.sin(2 * np.pi * rate * t))
    x = saw(f, n) + saw(f * 1.005, n)
    fc = 1500 + 1300 * np.sin(2 * np.pi * (rate / 2) * t) + 2500 * (t / dur)
    x = sweep(x, 'bp', fc, 6)
    x = np.tanh(12 * x)
    x = biquad(x, 'lp', 7000)
    return fade(normalize(x * adsr(n, 0.01, 0.2, 0.9, 0.1, dur - 0.1)))


def acid(note, dur=0.2, accent=1.0, cutoff=900):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = saw(hz(note), n)
    x = sweep(x, 'lp', cutoff + 3500 * accent * np.exp(-t / 0.06), 9)
    x = np.tanh(4 * x) * exp_env(t, 0.12 + 0.1 * accent, 0.01)
    return fade(normalize(x), fout=0.005)


def siren(dur=2.5):
    t = t_of(dur)
    f = 900 + 450 * np.sin(2 * np.pi * 0.8 * t - np.pi / 2)
    x = np.tanh(3 * (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * saw(f * 0.5)))
    x = biquad(x, 'lp', 5000) * adsr(len(t), 0.2, 1, 1, 0.4)
    return fade(normalize(x), fout=0.2)


def horn(notes=(53, 60, 65), dur=0.9):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sum(saw(hz(nt) * (1 - 0.06 * np.exp(-t / 0.05)), n) + pulse(hz(nt), 0.4, n) for nt in notes)
    x = biquad(np.tanh(2 * x / len(notes)), 'lp', 3000, 1.2) * adsr(n, 0.01, 0.3, 0.8, 0.15, dur - 0.15)
    return fade(normalize(x))


def riser(dur=3.0):
    t = t_of(dur)
    x = sweep(noise(len(t)), 'bp', 250 * (40 ** (t / dur)), 3)
    x += 0.4 * saw(110 * 2 ** (3 * t / dur), len(t))
    x = biquad(x, 'hp', 150) * (t / dur) ** 2
    return fade(normalize(np.tanh(2 * x)), fout=0.02)


def downlifter(dur=2.0):
    return normalize(riser(dur)[::-1])


def laser():
    t = t_of(0.4)
    x = np.tanh(4 * sine_sweep(3000 * np.exp(-t / 0.05) + 80)) * exp_env(t, 0.12)
    return fade(normalize(x))


def impact():
    t = t_of(2.5)
    boom = sine_sweep(35 + 120 * np.exp(-t / 0.05)) * exp_env(t, 0.7)
    x = np.tanh(3 * boom) + 0.5 * biquad(noise(len(t)), 'lp', 2000) * exp_env(t, 0.25)
    return fade(normalize(reverb(x, 1.5, 0.3)), fout=0.3)


def noise_hit():
    t = t_of(0.8)
    x = np.tanh(3 * biquad(noise(len(t)), 'bp', 2500, 0.6)) * exp_env(t, 0.15)
    return fade(normalize(x))


def reverse_crash():
    return normalize(crash()[::-1])


# ---------------------------------------------------------------- boucles

def step_len(bpm):
    return 60 / bpm / 4   # double-croche


def render(bpm, bars, events, choke=False):
    """events : (pas de double-croche, signal). La boucle est repliée pour tourner sans coupure.
    choke=True : chaque son coupe le précédent (kicks qui ne se chevauchent pas)."""
    n = int(round(bars * 240 / bpm * SR))
    out = np.zeros(n)
    events = sorted(events, key=lambda e: e[0])
    for k, (step, sig, *g) in enumerate(events):
        start = int(round(step * step_len(bpm) * SR))
        sig = sig * (g[0] if g else 1.0)
        if choke:
            nxt = events[(k + 1) % len(events)][0]
            nxt_start = int(round(nxt * step_len(bpm) * SR)) + (n if nxt <= step else 0)
            sig = fade(sig[:nxt_start - start], fout=0.004)
        for i in range(0, len(sig), n):   # repli en début de boucle
            chunk = sig[i:i + n]
            pos = (start + i) % n
            first = min(len(chunk), n - pos)
            out[pos:pos + first] += chunk[:first]
            out[:len(chunk) - first] += chunk[first:]
    return out


def mix(*loops):
    n = max(len(l) for l in loops)
    out = np.zeros(n)
    for l in loops:
        out[:len(l)] += l
    return normalize(np.tanh(1.2 * normalize(out, 1.0)), 0.89)


# ---------------------------------------------------------------- banques

F = 41  # fa1 : tonalité de base

def build(bpm=190):
    """Retourne deux banques : [(nom, [(nom_son, couleur, mode, signal mono|stéréo, bars|None)] x40)]."""
    RED, ORANGE, YELLOW, GREEN, CYAN, BLUE, VIOLET, MAGENTA, PINK, WHITE = 5, 9, 13, 21, 37, 41, 49, 53, 57, 3
    ONESHOT, HOLD, LOOP = 0, 1, 2

    k_main = gabber_kick(F)
    k_short = fade(k_main[:int(step_len(bpm) * 4 * SR)], fout=0.01)
    hh = hat(0.05)
    oh = hat(0.18, 3)
    cl = clap()
    rd = ride()

    four = [(s, k_main) for s in range(0, 16, 4)]
    kick_loop = normalize(render(bpm, 1, four, choke=True))
    offhat = render(bpm, 1, [(s, oh, 0.5) for s in range(2, 16, 4)])
    claps = render(bpm, 1, [(4, cl, 0.7), (12, cl, 0.7)])
    rides = render(bpm, 1, [(s, rd, 0.25) for s in range(0, 16, 2)])
    hats16 = render(bpm, 1, [(s, hh, 0.3 if s % 2 else 0.18) for s in range(16)])
    roll = render(bpm, 1, [(s, k_short) for s in range(0, 14, 2)] + [(14, k_short), (15, k_short)], choke=True)
    build_up = render(bpm, 4, [(s, k_short, 0.6 + 0.4 * s / 64) for s in
                               list(range(0, 16, 4)) + list(range(16, 32, 2)) + list(range(32, 48, 1)) +
                               [48 + i / 2 for i in range(32)]], choke=True)
    frenchcore = render(bpm, 1, [(0, frenchcore_kick()), (4, frenchcore_kick()), (8, frenchcore_kick()),
                                 (10, frenchcore_kick()), (12, frenchcore_kick())], choke=True)
    halftime = render(bpm, 2, [(0, k_main), (8, snare(), 0.8), (14, k_main), (16, k_main), (22, k_main), (24, snare(), 0.8)])

    riff = [(0, 0), (3, 0), (6, 3), (8, 7), (11, 5), (14, 3), (16, 0), (19, 0), (22, -2), (24, 3), (27, 2), (30, -2)]
    hoover_riff = render(bpm, 2, [(s, hoover(65 + n, dur=step_len(bpm) * 2.6, bend=(i % 4 == 0)), 0.8)
                                  for i, (s, n) in enumerate(riff)], choke=True)
    stab_riff = render(bpm, 2, [(s, stab([65, 68, 72], dur=0.3, verb=0.15), 0.8) for s in (2, 6, 10, 13, 18, 22, 26, 29, 30)])
    acid_seq = [(0, 0, 1), (1, 0, 0), (2, 12, 0.5), (3, 0, 0), (4, 3, 1), (5, 0, 0), (6, 15, 0.6), (7, 0, 0),
                (8, 0, 1), (9, 7, 0), (10, 12, 0.8), (11, 5, 0), (12, 3, 1), (13, 0, 0), (14, 10, 0.5), (15, 12, 1)]
    acid_loop = render(bpm, 1, [(s, acid(53 + n, dur=step_len(bpm) * 1.2, accent=a), 0.9) for s, n, a in acid_seq])
    screech_loop = render(bpm, 2, [(0, screech(77, dur=step_len(bpm) * 7, rate=bpm / 30)),
                                   (8, screech(80, dur=step_len(bpm) * 7, rate=bpm / 30)),
                                   (16, screech(75, dur=step_len(bpm) * 7, rate=bpm / 30)),
                                   (24, screech(72, dur=step_len(bpm) * 7, rate=bpm / 30))], choke=True)

    fm = [65, 68, 72]
    bank1 = [
        # rangée 1 : kicks
        ('Rotterdam', RED, ONESHOT, k_main, None),
        ('Rotterdam hard', RED, ONESHOT, gabber_kick(F + 2, drive=55, mid_db=9), None),
        ('Early', ORANGE, ONESHOT, gabber_kick(F + 5, drive=10, lp=3200, tail=0.8, dur=1.0, mid_db=3), None),
        ('Terror', RED, ONESHOT, gabber_kick(F + 7, drive=70, decay=0.12, tail=0.25, dur=0.4, punch=380), None),
        ('Industrial', ORANGE, ONESHOT, gabber_kick(F - 1, drive=40, crush=10, lp=5000), None),
        ('Frenchcore', ORANGE, ONESHOT, frenchcore_kick(), None),
        ('Reverse', RED, ONESHOT, reverse_kick(), None),
        ('Long doef', RED, ONESHOT, gabber_kick(F, drive=28, tail=1.0, dur=1.3), None),
        # rangée 2 : percussions
        ('Snare', YELLOW, ONESHOT, snare(), None),
        ('Clap', YELLOW, ONESHOT, cl, None),
        ('Dirty clap', YELLOW, ONESHOT, clap(9), None),
        ('Open hat', YELLOW, ONESHOT, oh, None),
        ('Closed hat', YELLOW, ONESHOT, hh, None),
        ('Ride', YELLOW, ONESHOT, rd, None),
        ('Crash', YELLOW, ONESHOT, crash(), None),
        ('Rim', YELLOW, ONESHOT, rim(), None),
        # rangée 3 : hoovers (fa mineur)
        *[(f'Hoover {nm}', VIOLET, HOLD, hoover(n, dur=1.4), None)
          for nm, n in zip(['F', 'G', 'G#', 'A#', 'C', 'C#', 'D#', 'F+'], [65, 67, 68, 70, 72, 73, 75, 77])],
        # rangée 4 : stabs et leads
        ('Stab Fm', CYAN, ONESHOT, stab(fm), None),
        ('Stab G#', CYAN, ONESHOT, stab([68, 72, 75]), None),
        ('Stab A#m', CYAN, ONESHOT, stab([70, 73, 77]), None),
        ('Stab Cm', CYAN, ONESHOT, stab([72, 75, 79]), None),
        ('Screech', MAGENTA, HOLD, screech(77, 1.5), None),
        ('Screech 2', MAGENTA, HOLD, screech(72, 1.5, rate=11), None),
        ('Horn', MAGENTA, ONESHOT, horn(), None),
        ('Siren', MAGENTA, HOLD, siren(), None),
        # rangée 5 : boucles
        ('Kick 4/4', GREEN, LOOP, kick_loop, 1),
        ('Beat', GREEN, LOOP, mix(kick_loop, offhat, claps), 1),
        ('Beat full', GREEN, LOOP, mix(kick_loop, offhat, claps, rides, hats16), 1),
        ('Roll', GREEN, LOOP, roll, 1),
        ('Build-up', GREEN, LOOP, build_up, 4),
        ('Hoover riff', BLUE, LOOP, hoover_riff, 2),
        ('Stab riff', BLUE, LOOP, stab_riff, 2),
        ('Acid', BLUE, LOOP, acid_loop, 1),
    ]

    kick_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G']
    bank2 = [
        # rangée 1 : kicks accordés (pour coller à la tonalité d'un morceau)
        *[(f'Kick {nm}', RED, ONESHOT, gabber_kick(36 + i, drive=35), None) for i, nm in enumerate(kick_names)],
        # rangée 2 : effets
        ('Riser', WHITE, ONESHOT, riser(), None),
        ('Downlifter', WHITE, ONESHOT, downlifter(), None),
        ('Laser', WHITE, ONESHOT, laser(), None),
        ('Impact', WHITE, ONESHOT, impact(), None),
        ('Noise hit', WHITE, ONESHOT, noise_hit(), None),
        ('Reverse crash', WHITE, ONESHOT, reverse_crash(), None),
        ('Long siren', WHITE, HOLD, siren(5), None),
        ('High horn', WHITE, ONESHOT, horn((65, 72, 77)), None),
        # rangée 3 : boucles rythmiques
        ('Frenchcore', GREEN, LOOP, frenchcore, 1),
        ('Half-time', GREEN, LOOP, normalize(halftime), 2),
        ('Hats 16', GREEN, LOOP, normalize(hats16), 1),
        ('Off-hat', GREEN, LOOP, normalize(offhat), 1),
        ('Claps', GREEN, LOOP, normalize(claps), 1),
        ('Ride', GREEN, LOOP, normalize(rides), 1),
        ('Beat + ride', GREEN, LOOP, mix(kick_loop, rides, claps), 1),
        ('Roll full', GREEN, LOOP, mix(roll, hats16), 1),
        # rangée 4 : boucles mélodiques
        ('Screech riff', BLUE, LOOP, screech_loop, 2),
        ('Acid + kick', BLUE, LOOP, mix(kick_loop, acid_loop), 1),
        ('Hoover + beat', BLUE, LOOP, mix(np.tile(kick_loop, 2), np.tile(offhat, 2), hoover_riff), 2),
        ('Stabs + beat', BLUE, LOOP, mix(np.tile(kick_loop, 2), np.tile(claps, 2), stab_riff), 2),
        ('Acid only', BLUE, LOOP, normalize(acid_loop), 1),
        ('Hoover only', BLUE, LOOP, normalize(hoover_riff), 2),
        ('Stabs only', BLUE, LOOP, normalize(stab_riff), 2),
        ('Build full', BLUE, LOOP, mix(build_up, np.tile(hats16, 4)), 4),
        # rangée 5 : stabs rave (une note par pad)
        *[(f'Rave {nm}', PINK, ONESHOT, stab([n, n + 3, n + 7], dur=0.45, drive=4), None)
          for nm, n in zip(['F', 'G', 'G#', 'A#', 'C', 'C#', 'D#', 'F+'], [65, 67, 68, 70, 72, 73, 75, 77])],
    ]
    return [('Gabber', bank1), ('Gabber 2', bank2)]
