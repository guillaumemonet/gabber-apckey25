"""Synthèse de sons hardcore / gabber (aucun échantillon externe : libres de droits).

Kicks Rotterdam distordus, hoovers, stabs rave, screeches, percussions, effets
et boucles calées au tempo. Tonalité : fa mineur.
"""
import numpy as np

SR = 44100
rng = np.random.default_rng(190)


def reseed(bank):
    """Hasard propre à chaque banque : modifier une banque ne change pas les fichiers des autres."""
    global rng
    rng = np.random.default_rng(sum(ord(c) * (k + 1) for k, c in enumerate(bank)) + 190)


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


def crash909():
    """Crash façon 909 : plus claire, plus courte et moins saturée que la crash gabber."""
    t = t_of(1.6)
    x = metal(len(t), 58) * exp_env(t, 0.35) + biquad(noise(len(t)), 'hp', 6000) * exp_env(t, 0.5) * 0.8
    return fade(normalize(biquad(x, 'peak', 9000, 1, 4)), fout=0.2)


def reverse_crash():
    return normalize(crash()[::-1])


# ---------------------------------------------------------------- cordes et basses (banque Hardcore)

def strings(notes, dur=3.0, attack=0.35, release=0.8, bright=3800, verb=0.35):
    """Ensemble de cordes : scies désaccordées + octave, vibrato retardé, chorus, réverbe."""
    n = int((dur + release) * SR)
    t = np.arange(n) / SR
    vib = 0.12 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.3) / 0.5, 0, 1)
    x = np.zeros(n)
    for nt in notes:
        for cents in (-14, -7, -2, 3, 8, 13):
            x += saw(hz(nt + vib + cents / 100), n)
        x += 0.35 * saw(hz(nt + 12 + vib), n)
    x = biquad(x / (len(notes) * 6), 'lp', bright, 0.7)
    x = biquad(x, 'hp', 160)
    x = biquad(x, 'peak', 1800, 1.0, 3)          # présence « archet »
    x = chorus(x, depth_ms=5, rate=0.5) * adsr(n, attack, 0.6, 0.85, release, dur)
    return fade(normalize(reverb(fade(x), 2.2, verb)), fout=0.3)


def staccato(notes, dur=0.16, verb=0.2):
    n = int((dur + 0.15) * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for nt in notes:
        for cents in (-10, -3, 4, 11):
            x += saw(hz(nt + cents / 100), n)
    x = biquad(x / (len(notes) * 4), 'lp', 5200, 0.8)
    x = biquad(x, 'hp', 200) * adsr(n, 0.008, 0.08, 0.5, 0.08, dur)
    return fade(normalize(reverb(fade(x), 1.2, verb)), fout=0.05)


def orchestra_hit(notes=(53, 56, 60, 65, 68, 72)):
    """Coup d'orchestre : cordes + cuivres + timbale + souffle, grosse réverbe."""
    t = t_of(0.9)
    st = staccato(notes, 0.35, verb=0)[:len(t)]
    br = horn(tuple(n - 12 for n in notes[:3]), 0.6)[:len(t)]
    timp = np.tanh(3 * sine_sweep(hz(29) * (1 + 0.4 * np.exp(-t / 0.03))) * exp_env(t, 0.35))
    air = biquad(noise(len(t)), 'bp', 3000, 0.7) * exp_env(t, 0.05)
    x = np.zeros(len(t))
    for part, g in ((st, 1), (br, 0.6), (timp, 0.9), (air, 0.3)):
        x[:len(part)] += g * part
    return fade(normalize(reverb(np.tanh(1.5 * x), 2.5, 0.4)), fout=0.3)


def hc_bass(note, dur=0.3, drive=6, cutoff=2600):
    """Basse hardcore : scie + carré à l'octave basse + sinus, filtre qui se referme, saturation."""
    n = int((dur + 0.02) * SR)
    t = np.arange(n) / SR
    f = hz(note)
    x = saw(f, n) + 0.7 * np.sign(np.sin(2 * np.pi * f / 2 * t)) + 0.8 * np.sin(2 * np.pi * f / 2 * t)
    x = sweep(x / 2.5, 'lp', 350 + cutoff * np.exp(-t / 0.05), 3)
    x = np.tanh(drive * x)
    x = biquad(biquad(x, 'lp', 5000), 'hp', 30) * adsr(n, 0.002, 0.15, 0.8, 0.02, dur)
    return fade(normalize(x), fout=0.006)


def reese(note, dur=2.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(note)
    x = saw(f * 2 ** (-0.15 / 12), n) + saw(f * 2 ** (0.15 / 12), n) + 0.9 * np.sin(2 * np.pi * f / 2 * t)
    x = sweep(x / 2.5, 'lp', 700 + 600 * np.sin(2 * np.pi * 0.5 * t), 4)
    x = np.tanh(3 * x) * adsr(n, 0.01, 0.2, 0.9, 0.05, dur - 0.05)
    return fade(normalize(x), fout=0.01)


def mainstream_kick(note=41):
    """Kick mainstream : attaque courte puis queue tonale saturée qui descend."""
    t = t_of(0.7)
    punch = gabber_kick(note + 12, drive=50, decay=0.04, tail=0.06, dur=0.7, lp=9000)
    tail_f = hz(note + 12) * (1 + 0.8 * np.exp(-t / 0.05)) * (1 - 0.35 * t)
    tail = np.tanh(10 * sine_sweep(tail_f)) * exp_env(t, 0.35, 0.08) * np.clip((t - 0.03) / 0.02, 0, 1)
    tail = biquad(biquad(tail, 'bp', 900, 1.5), 'lp', 4000)
    return fade(normalize(punch + 0.9 * normalize(tail)), fout=0.03)


def industrial_kick(note=39):
    t = t_of(0.6)
    k = gabber_kick(note, drive=50, crush=6, dur=0.6)
    grit = np.round(biquad(noise(len(t)), 'bp', 1500, 0.8) * 6) / 6 * exp_env(t, 0.12)
    return fade(normalize(k + 0.35 * grit), fout=0.03)


# ---------------------------------------------------------------- oldschool (rave / hardcore début 90)

def kick808(note=29, dur=1.6):
    t = t_of(dur)
    x = sine_sweep(hz(note) * (1 + 1.5 * np.exp(-t / 0.02))) * exp_env(t, dur / 3, 0.02)
    x += noise(len(t)) * np.exp(-t / 0.002) * 0.2
    return fade(normalize(np.tanh(2 * x)), fout=0.05)


def break_kick():
    t = t_of(0.35)
    x = sine_sweep(55 + 90 * np.exp(-t / 0.015)) * exp_env(t, 0.12)
    x += biquad(noise(len(t)), 'lp', 3000) * np.exp(-t / 0.004) * 0.5
    return fade(normalize(np.tanh(1.5 * x)))


def break_snare(level=1.0, dur=0.25):
    """Snare de breakbeat : peau + timbre + petite pièce."""
    t = t_of(dur)
    body = sine_sweep(210 + 40 * np.exp(-t / 0.01)) * exp_env(t, 0.05)
    wires = biquad(biquad(noise(len(t)), 'bp', 3500, 0.7), 'hp', 900) * exp_env(t, dur / 3.5)
    x = np.tanh(2 * (0.7 * body + wires))
    return fade(normalize(reverb(x, 0.35, 0.18))[:int((dur + 0.1) * SR)] * level)


def tambourine():
    t = t_of(0.3)
    jingles = biquad(noise(len(t)), 'bp', 7500, 2) * exp_env(t, 0.08)
    shake = biquad(noise(len(t)), 'hp', 5000) * np.clip(t / 0.01, 0, 1) * exp_env(t, 0.05)
    return fade(normalize(jingles + 0.6 * shake))


def rave_piano(notes, dur=1.4, verb=0.25):
    """Piano « house » façon M1 : partiels légèrement inharmoniques, marteau, réverbe."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for nt in notes:
        f = hz(nt)
        for k in range(1, 11):
            fk = k * f * np.sqrt(1 + 0.0004 * k * k)
            if fk > SR * 0.45:
                break
            amp = 1 / k ** 1.2
            for det in (-0.6, 0.6):   # deux cordes par note, légèrement désaccordées
                x += amp * np.sin(2 * np.pi * (fk + det) * t + rng.random() * 6.28) * np.exp(-t / (0.9 / k ** 0.6))
    x /= len(notes) * 6
    hammer = biquad(noise(n), 'bp', 2500, 1) * np.exp(-t / 0.006) * 0.6
    x = biquad(x + hammer, 'peak', 3000, 0.8, 4) * np.clip(t / 0.002, 0, 1)
    return fade(normalize(reverb(x, 1.4, verb)), fout=0.1)


def mentasm(notes, dur=0.9):
    """Stab « Mentasm » : scies désaccordées à l'octave, glissé vers le bas, chorus épais."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    bend = 3 * np.exp(-t / 0.05) - 1.2 * t
    x = np.zeros(n)
    for nt in notes:
        for c in (-20, -8, 0, 9, 21):
            x += saw(hz(nt + bend + c / 100), n)
        x += 0.7 * pulse(hz(nt - 12 + bend), 0.3, n)
    x = chorus(x / (len(notes) * 6), depth_ms=9, rate=1.1)
    x = np.tanh(2 * biquad(x, 'lp', 3500, 1.2)) * adsr(n, 0.005, 0.25, 0.6, 0.2, dur - 0.2)
    return fade(normalize(x))


def belgian_stab(notes, dur=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sum(saw(hz(nt), n) + np.sign(np.sin(2 * np.pi * hz(nt + 0.08) * t)) for nt in notes)
    x = sweep(x / (2 * len(notes)), 'lp', 300 + 5000 * np.exp(-t / 0.06), 5)
    x = np.tanh(3 * x) * exp_env(t, 0.15, 0.01)
    return fade(normalize(reverb(x, 0.9, 0.2)), fout=0.08)


VOWEL_A = ((800, 1.0, 8), (1150, 0.6, 9), (2900, 0.25, 10))
VOWEL_O = ((450, 1.0, 8), (800, 0.5, 9), (2830, 0.15, 10))


def choir(notes, dur=3.0, vowel=VOWEL_A, attack=0.3, release=0.7, verb=0.4):
    """Chœur « ahh » : scies passées dans des filtres de formants, vibrato, chorus."""
    n = int((dur + release) * SR)
    t = np.arange(n) / SR
    vib = 0.15 * np.sin(2 * np.pi * 5 * t) * np.clip((t - 0.2) / 0.4, 0, 1)
    src = np.zeros(n)
    for nt in notes:
        for c in (-9, 0, 8):
            src += saw(hz(nt + vib + c / 100), n)
    x = sum(g * biquad(src, 'bp', f, q) for f, g, q in vowel)
    x = chorus(x, depth_ms=7, rate=0.4) * adsr(n, attack, 0.5, 0.9, release, dur)
    return fade(normalize(reverb(fade(x), 2.0, verb)), fout=0.3)


def vox_stab(note=65):
    """Petit « oh-ah » : passage de la voyelle o vers a."""
    a = choir([note, note + 7], 0.25, VOWEL_O, attack=0.01, release=0.15, verb=0)
    b = choir([note, note + 7], 0.25, VOWEL_A, attack=0.01, release=0.2, verb=0)
    cross = np.linspace(0, 1, min(len(a), len(b)))
    x = a[:len(cross)] * (1 - cross) + b[:len(cross)] * cross
    return fade(normalize(reverb(x, 0.8, 0.25)), fout=0.1)


def whistle():
    t = t_of(0.9)
    f = 2300 + 500 * np.sin(2 * np.pi * 14 * t) * np.clip((t - 0.25) / 0.05, 0, 1) + 600 * np.exp(-t / 0.05)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.15 * biquad(noise(len(t)), 'bp', 2500, 3)
    return fade(normalize(x * adsr(len(t), 0.01, 0.2, 0.9, 0.1, 0.75)), fout=0.05)


def air_raid(dur=4.0):
    t = t_of(dur)
    f = 250 + 650 * np.clip(t / (dur * 0.45), 0, 1) - 450 * np.clip((t - dur * 0.6) / (dur * 0.4), 0, 1)
    x = saw(f, len(t)) + saw(f * 1.5, len(t)) * 0.5
    x = biquad(np.tanh(2 * x), 'lp', 3000) * adsr(len(t), 0.3, 1, 1, 0.5)
    return fade(normalize(x), fout=0.3)


def hoover_down(note=65, dur=1.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    drop = -12 * np.clip((t - 0.1) / (dur - 0.2), 0, 1) ** 1.5
    x = sum(saw(hz(note + drop + c / 100), n) for c in (-25, -10, 0, 12, 26)) + 0.8 * saw(hz(note - 12 + drop), n)
    x = np.tanh(1.8 * biquad(chorus(x / 6, 8, 0.9), 'lp', 4000)) * adsr(n, 0.01, 0.3, 0.9, 0.15, dur - 0.15)
    return fade(normalize(x))


def scratch():
    t = t_of(0.6)
    speed = np.abs(np.sin(2 * np.pi * 3.3 * t)) ** 0.7
    src = saw(180 + 900 * speed, len(t)) * 0.5 + noise(len(t)) * 0.5
    x = sweep(src, 'bp', 400 + 3000 * speed, 2) * (speed > 0.15)
    return fade(normalize(np.tanh(2 * x)), fout=0.02)


def rave_zap():
    t = t_of(0.35)
    x = np.sign(np.sin(2 * np.pi * np.cumsum(1800 * np.exp(-t / 0.06) + 60) / SR)) * exp_env(t, 0.1)
    return fade(normalize(biquad(x, 'lp', 6000)))


def slice_loop(loop, order, slices):
    """Redécoupe une boucle en `slices` tranches égales et les réordonne (break « chopé »)."""
    size = len(loop) // slices
    parts = [fade(loop[i * size:(i + 1) * size], fin=0.001, fout=0.003) for i in range(slices)]
    out = np.concatenate([parts[i] for i in order])
    return np.concatenate([out, np.zeros(len(loop) - len(out))])


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


def layer(a, b, gain_b=1.0):
    """Superpose deux sons de longueurs différentes."""
    out = np.zeros(max(len(a), len(b)))
    out[:len(a)] += a
    out[:len(b)] += gain_b * b
    return normalize(out)


def mix(*loops):
    n = max(len(l) for l in loops)
    out = np.zeros(n)
    for l in loops:
        out[:len(l)] += l
    return normalize(np.tanh(1.2 * normalize(out, 1.0)), 0.89)


# ---------------------------------------------------------------- kicks des boucles (sidechain)
# Position des kicks de chaque boucle, en doubles-croches depuis le début (0.5 = entre deux) :
# l'application s'en sert pour déclencher le sidechain exactement sur les kicks.

def four(bars=1):
    return [s + 16 * b for b in range(bars) for s in (0, 4, 8, 12)]


def union(*lists):
    return sorted(set(x for l in lists for x in l))


ROLL = list(range(0, 14, 2)) + [14, 15]
GABBER_BUILD = list(range(0, 16, 4)) + list(range(16, 32, 2)) + list(range(32, 48)) + [48 + i / 2 for i in range(32)]
AMEN = [0, 2, 10, 11, 16, 18, 26]
# Break découpé : 16 tranches de 2 doubles-croches réordonnées.
CHOP = [j * 2 + o for j, i in enumerate([0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 4, 5, 12, 13, 14, 15]) for o in (0, 1) if i * 2 + o in AMEN]
GALLOP = [0, 3, 4, 7, 8, 11, 12, 14, 15]
MAIN_BUILD = list(range(0, 32, 4)) + list(range(32, 48, 2)) + list(range(48, 64))
WAVE_BUILD = list(range(0, 32, 4)) + list(range(32, 48, 2)) + list(range(48, 60)) + [60 + i / 2 for i in range(8)]

KICKS = {
    'Gabber': {'Kick 4/4': four(), 'Beat': four(), 'Beat full': four(), 'Roll': ROLL, 'Build-up': GABBER_BUILD},
    'Gabber 2': {'Frenchcore': [0, 4, 8, 10, 12], 'Half-time': [0, 14, 16, 22],
                 'Acid + kick': four(), 'Hoover + beat': four(2), 'Stabs + beat': four(2), 'Doomcore beat': [0, 8],
                 'Kick triplets': [k * 16 / 6 for k in range(6)]},
    'Hardcore': {'Bass + kick': four(), 'Strings + beat': four(4), 'Full track': four(4), 'Terror loop': list(range(0, 16, 2)),
                 'Kick gallop': GALLOP, 'Industrial loop': four(), 'Speed roll': list(range(16)), 'Hard beat': four(),
                 'Terror gallop': GALLOP},
    'Oldschool': {'Amen-style break': AMEN, 'Break + kick': union(four(2), AMEN), 'Chopped break': CHOP,
                  'Oldschool track': union(four(4), AMEN, [x + 32 for x in AMEN])},
    'Mainstream': {'Mainstream beat': four(), 'Mainstream gallop': GALLOP, 'Build-up': MAIN_BUILD, 'Full track': four(4)},
    'New wave': {'Uptempo beat': four(), 'Kick-bass loop': four(), 'Kick melody': list(range(0, 32, 4)), 'Gallop': GALLOP,
                 'Build-up': WAVE_BUILD, 'Full drop': four(4)},
    'Hardstyle': {'Hardstyle beat': four(), 'Reverse bass loop': four(), 'Reverse bass prog': four(4), 'Rawstyle loop': [0, 4, 8, 12, 14, 15],
                  'Kick build-up': MAIN_BUILD, 'Full drop': four(4)},
    'Anthems': {'Guitar + kick': four(4), 'Anthem beat': four(4), 'Anthem beat ride': four(4),
                'Anthem gallop beat': [b * 16 + s for b in range(4) for s in GALLOP],
                'Kick roll build': list(range(0, 16, 4)) + list(range(16, 32, 2)) + list(range(32, 48)) + [48 + i / 2 for i in range(32)],
                'Half-time beat': [b * 16 + s for b in range(4) for s in (0, 10)], 'Off-kick beat': [b * 16 + s for b in range(4) for s in (0, 4, 8, 12, 14)],
                'Festival anthem': four(4), 'Guitar anthem': four(4), 'Anthem riff drop': four(4), 'Anthem screech drop': four(4),
                'Anthem build': list(range(0, 16, 4)) + list(range(16, 32, 2)) + list(range(32, 48)) + [48 + i / 2 for i in range(32)],
                'Guitar breakdown drop': [b * 16 + s for b in range(4) for s in (0, 10)], 'Anthem finale': four(4)},
}


def kicks_of(bank, name):
    """Kicks d'une boucle (liste de doubles-croches), ou None si elle n'en contient pas."""
    return KICKS.get(bank, {}).get(name)


# ---------------------------------------------------------------- banques

F = 41  # fa1 : tonalité de base

def build(bpm=190):
    """Retourne deux banques : [(nom, [(nom_son, couleur, mode, signal mono|stéréo, bars|None)] x40)]."""
    reseed('Gabber')
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

    reseed('Gabber 2')
    kick_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G']
    bank2 = [
        # rangée 1 : kicks accordés (pour coller à la tonalité d'un morceau)
        # (kicks « doomcore » : plus lents et plus sombres, pour ne pas doubler ceux de la banque Gabber)
        *[(f'Kick {nm}', RED, ONESHOT, gabber_kick(36 + i, drive=18, tail=0.9, dur=1.1, lp=3500, mid_db=3), None) for i, nm in enumerate(kick_names)],
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
        ('Doomcore beat', GREEN, LOOP, mix(normalize(render(bpm, 1, [(0, k_main), (8, k_main)], choke=True)), render(bpm, 1, [(4, snare(), 0.8), (12, snare(), 0.8)]), rides), 1),
        ('Kick triplets', GREEN, LOOP, normalize(render(bpm, 1, [(s * 16 / 6, k_short) for s in range(6)], choke=True)), 1),
        # rangée 4 : boucles mélodiques
        ('Screech riff', BLUE, LOOP, screech_loop, 2),
        ('Acid + kick', BLUE, LOOP, mix(kick_loop, acid_loop), 1),
        ('Hoover + beat', BLUE, LOOP, mix(np.tile(kick_loop, 2), np.tile(offhat, 2), hoover_riff), 2),
        ('Stabs + beat', BLUE, LOOP, mix(np.tile(kick_loop, 2), np.tile(claps, 2), stab_riff), 2),
        ('Acid 2', BLUE, LOOP, normalize(render(bpm, 2, [(s, acid(53 + n, dur=step_len(bpm) * (2.2 if s in (6, 22) else 1.1), accent=a), 0.9) for s, n, a in
            [(0, 0, 1), (2, 0, 0.3), (3, 3, 0.6), (4, 0, 1), (6, 7, 0.8), (8, 12, 1), (10, 10, 0.4), (11, 8, 0.6), (12, 7, 1), (14, 3, 0.5),
             (16, 0, 1), (18, 0, 0.3), (19, 15, 0.9), (20, 12, 0.6), (22, 10, 1), (24, 8, 0.7), (26, 7, 0.5), (28, 5, 1), (30, 3, 0.6)]])), 2),
        ('Hoover riff 2', BLUE, LOOP, normalize(render(bpm, 2, [(s, hoover(65 + n, dur=step_len(bpm) * 3.5, bend=(i % 2 == 0)), 0.8)
            for i, (s, n) in enumerate([(0, 0), (4, 3), (8, 7), (12, 5), (16, -4), (20, -2), (24, 0), (28, 3)])], choke=True)), 2),
        ('Stab riff 2', BLUE, LOOP, normalize(render(bpm, 2, [(s, stab(c, dur=0.25, verb=0.2), 0.8) for s, c in
            [(2, [61, 65, 68]), (6, [61, 65, 68]), (10, [60, 63, 68]), (14, [60, 63, 68]), (18, [63, 67, 70]), (22, [63, 67, 70]), (26, [65, 68, 72]), (29, [65, 68, 72]), (30, [65, 68, 72])]])), 2),
        ('Snare build', YELLOW, LOOP, mix(render(bpm, 4, [(s, snare(5), 0.3 + 0.7 * s / 64) for s in list(range(0, 32, 4)) + list(range(32, 48, 2)) + list(range(48, 64))]), riser(240 / bpm * 4) * 0.5), 4),
        # rangée 5 : stabs rave (une note par pad)
        *[(f'Rave {nm}', PINK, ONESHOT, stab([n, n + 3, n + 7], dur=0.45, drive=4), None)
          for nm, n in zip(['F', 'G', 'G#', 'A#', 'C', 'C#', 'D#', 'F+'], [65, 67, 68, 70, 72, 73, 75, 77])],
    ]
    return [('Gabber', bank1), ('Gabber 2', bank2), ('Hardcore', build_hardcore(bpm)), ('Oldschool', build_oldschool(bpm)),
            ('Mainstream', build_mainstream(bpm)), ('New wave', build_newwave(bpm)), ('Hardstyle', build_hardstyle(150), 150),
            ('Melodies', build_melodies(bpm)), ('Hardstyle melodies', build_hardstyle_melodies(150), 150),
            ('Anthems', build_anthems(bpm))]


def build_oldschool(bpm=190):
    """Rave / hardcore début 90 : 909, breakbeats, pianos, stabs, chœurs. Même tempo et tonalité que les autres."""
    reseed('Oldschool')
    RED, ORANGE, YELLOW, GREEN, CYAN, BLUE, VIOLET, PINK, WHITE = 5, 9, 13, 21, 37, 41, 49, 57, 3
    ONESHOT, HOLD, LOOP = 0, 1, 2
    step = step_len(bpm)
    bar = 16

    k909 = gabber_kick(F, drive=4, lp=5000, mid_db=2, tail=0.7, dur=0.9, asym=0.1)
    kb = break_kick()
    sn = break_snare()
    ghost = break_snare(0.35, 0.12)
    rd = ride()
    oh = hat(0.25, 1.5)
    chords = {'Fm': [53, 56, 60, 65], 'Db': [49, 53, 56, 61], 'Eb': [51, 55, 58, 63],
              'Cm': [48, 51, 55, 60], 'Bbm': [46, 53, 58, 61], 'Ab': [48, 51, 56, 60]}

    # Break façon Amen sur 2 mesures (K = kick, S = snare, g = ghost), ride en croches.
    pattern = [
        ('K', 0), ('K', 2), ('S', 4), ('g', 7), ('S', 9), ('K', 10), ('K', 11), ('S', 12), ('g', 15),
        ('K', 16), ('K', 18), ('S', 20), ('g', 23), ('S', 25), ('K', 26), ('S', 28), ('g', 30), ('S', 31),
    ]
    hits = {'K': (kb, 1.0), 'S': (sn, 0.9), 'g': (ghost, 1.0)}
    brk = render(bpm, 2, [(s, hits[h][0], hits[h][1]) for h, s in pattern] + [(s, rd, 0.2) for s in range(0, 32, 2)])
    brk = normalize(brk)
    chopped = slice_loop(brk, [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 4, 5, 12, 13, 14, 15], 16)
    kick_loop = normalize(render(bpm, 1, [(s, k909) for s in range(0, 16, 4)], choke=True))

    stab_steps = [0, 3, 6, 10, 12]
    piano = {c: rave_piano(chords[c], step * 3, verb=0.15) for c in ('Fm', 'Db')}
    piano_riff = render(bpm, 2, [(b * bar + s, piano[c], 0.9) for b, c in enumerate(('Fm', 'Db')) for s in stab_steps])
    arp_notes = [[65, 68, 72, 77], [61, 65, 68, 73]]
    plucks = {nt: belgian_stab([nt], step * 1.2) for row in arp_notes for nt in row}
    arp = render(bpm, 2, [(b * bar + s, plucks[arp_notes[b][s % 4]], 0.8) for b in range(2) for s in range(16)])
    ment = {c: mentasm(chords[c][1:], step * 5) for c in ('Fm', 'Db', 'Eb')}
    ment_riff = render(bpm, 2, [(0, ment['Fm']), (6, ment['Fm']), (12, ment['Fm']),
                                (16, ment['Db']), (22, ment['Db']), (28, ment['Eb'])], choke=True)
    prog = ['Fm', 'Db', 'Eb', 'Cm']
    choir_prog = render(bpm, 4, [(b * bar, choir(chords[c], dur=step * bar, attack=0.25, release=0.5)) for b, c in enumerate(prog)])
    subs = render(bpm, 4, [(b * bar, kick808(r, step * bar * 0.9), 0.6) for b, r in enumerate((29, 25, 27, 24))])

    four = lambda loop: np.tile(loop, 4)
    bank = [
        # rangée 1 : kicks d'époque
        ('909 boom', RED, ONESHOT, k909, None),
        ("Kick '91", RED, ONESHOT, gabber_kick(F + 4, drive=10, decay=0.09, tail=0.3, dur=0.55, lp=3000, mid_db=2), None),
        ('808 long', ORANGE, ONESHOT, kick808(), None),
        ('Thunderdome', RED, ONESHOT, gabber_kick(F + 2, drive=20, tail=1.1, dur=1.3, lp=3800), None),
        ("Kick '93", RED, ONESHOT, gabber_kick(F + 5, drive=8, decay=0.12, tail=0.2, dur=0.4), None),
        ('Break kick', ORANGE, ONESHOT, kb, None),
        ('Soft doef', ORANGE, ONESHOT, gabber_kick(F, drive=6, lp=2500, tail=0.9, dur=1.1), None),
        ('Kick + sub', RED, ONESHOT, layer(k909, kick808(29, 1.2), 0.7), None),
        # rangée 2 : éléments de breakbeat
        ('Break snare', YELLOW, ONESHOT, sn, None),
        ('Ghost snare', YELLOW, ONESHOT, normalize(ghost), None),
        ('Cowbell 808', YELLOW, ONESHOT, cowbell808(), None),
        ('Shaker', YELLOW, ONESHOT, shaker(), None),
        ('Open hat', YELLOW, ONESHOT, oh, None),
        ('Clap 909', YELLOW, ONESHOT, clap(2), None),
        ('Tambourine', YELLOW, ONESHOT, tambourine(), None),
        ('Crash', YELLOW, ONESHOT, crash909(), None),   # (crash 909, différente de celle de la banque Gabber)
        # rangée 3 : pianos rave et stabs
        *[(f'Piano {c}', PINK, ONESHOT, rave_piano(chords[c]), None) for c in ['Fm', 'Db', 'Eb', 'Cm', 'Bbm', 'Ab']],
        ('Mentasm', VIOLET, ONESHOT, mentasm(chords['Fm'][1:]), None),
        ('Belgian stab', VIOLET, ONESHOT, belgian_stab([65, 68, 72]), None),
        # rangée 4 : voix, effets, leads
        ('Choir ahh', CYAN, HOLD, choir(chords['Fm']), None),
        ('Vox stab', CYAN, ONESHOT, vox_stab(), None),
        ('Whistle', WHITE, ONESHOT, whistle(), None),
        ('Air raid', WHITE, HOLD, air_raid(), None),
        ('Hoover down', VIOLET, ONESHOT, hoover_down(), None),
        ('Sub boom', BLUE, ONESHOT, kick808(29, 2.5), None),
        ('Rave zap', WHITE, ONESHOT, rave_zap(), None),
        ('Scratch', WHITE, ONESHOT, scratch(), None),
        # rangée 5 : boucles
        ('Amen-style break', GREEN, LOOP, brk, 2),
        ('Break + kick', GREEN, LOOP, mix(np.tile(kick_loop, 2), brk * 0.8), 2),
        ('Chopped break', GREEN, LOOP, normalize(chopped), 2),
        ('Piano riff', PINK, LOOP, normalize(piano_riff), 2),
        ('Rave arp', BLUE, LOOP, normalize(arp), 2),
        ('Mentasm riff', VIOLET, LOOP, normalize(ment_riff), 2),
        ('Choir chords', CYAN, LOOP, normalize(choir_prog), 4),
        ('Oldschool track', GREEN, LOOP, mix(four(kick_loop), np.tile(brk, 2) * 0.7, np.tile(piano_riff, 2) * 0.8,
                                              choir_prog * 0.5, subs * 0.8), 4),
    ]
    return bank


def build_hardcore(bpm=190):
    """Banque plus dure : kicks terror/uptempo, basses, cordes, boucles au même tempo que les banques Gabber."""
    reseed('Hardcore')
    RED, ORANGE, YELLOW, GREEN, CYAN, BLUE, VIOLET, PINK, WHITE = 5, 9, 13, 21, 37, 41, 49, 57, 3
    ONESHOT, HOLD, LOOP = 0, 1, 2
    step = step_len(bpm)
    bar = 16

    k_hard = gabber_kick(F, drive=50, mid_db=8)
    k_terror = gabber_kick(F + 12, drive=90, decay=0.06, tail=0.12, dur=0.25, punch=500, mid_db=10)
    k_speed = gabber_kick(F + 10, drive=120, decay=0.04, tail=0.07, dur=0.15, punch=700)
    k_up = gabber_kick(F + 3, drive=60, tail=0.9, dur=1.0, lp=8000, mid_db=10)
    hh = hat(0.05, 3)
    oh = hat(0.2, 4)
    cl = clap(6)
    sn = snare(6)
    grit = noise_hit()

    # Accords de fa mineur : Fm, Db, Eb, Cm, Bbm, Ab (voicings moyens pour les nappes).
    chords = {'Fm': [53, 56, 60, 65], 'Db': [49, 53, 56, 61], 'Eb': [51, 55, 58, 63],
              'Cm': [48, 51, 55, 60], 'Bbm': [46, 53, 58, 61], 'Ab': [48, 51, 56, 60]}
    roots = [41, 37, 39, 36]   # basse suivant la progression Fm - Db - Eb - Cm
    prog = ['Fm', 'Db', 'Eb', 'Cm']

    kick_loop = normalize(render(bpm, 1, [(s, k_hard) for s in range(0, 16, 4)], choke=True))
    offhat = render(bpm, 1, [(s, oh, 0.5) for s in range(2, 16, 4)])
    hats16 = render(bpm, 1, [(s, hh, 0.3 if s % 2 else 0.15) for s in range(16)])
    claps = render(bpm, 1, [(4, cl, 0.7), (12, cl, 0.7)])

    # Basses calées sur la grille (entre les kicks).
    off_bass = render(bpm, 1, [(s, hc_bass(41, step * 1.8)) for s in (2, 6, 10, 14)])
    roll_bass = render(bpm, 1, [(s, hc_bass(41, step * 0.9, drive=8)) for s in range(16) if s % 4])
    reese_loop = render(bpm, 2, [(0, reese(41, step * bar)), (bar, reese(37, step * bar))], choke=True)
    prog_bass = render(bpm, 4, [(b * bar + s, hc_bass(r, step * 1.8)) for b, r in enumerate(roots) for s in (2, 6, 10, 14)])

    # Cordes : ostinato en doubles-croches (Fm puis Db) et nappes sur la progression.
    stac = {nt: staccato([nt], step * 0.8, verb=0.1) for nt in (61, 65, 68, 72)}
    arp = [[65, 68, 72, 68], [61, 65, 68, 65]]
    ostinato = render(bpm, 2, [(b * bar + s, stac[arp[b][s % 4]], 0.9 if s % 4 == 0 else 0.7)
                               for b in range(2) for s in range(16)])
    pads = render(bpm, 4, [(b * bar, strings(chords[c], dur=step * bar, attack=0.2, release=0.6)) for b, c in enumerate(prog)])

    terror = render(bpm, 1, [(s, k_terror) for s in range(0, 16, 2)], choke=True)
    gallop = render(bpm, 1, [(s, k_hard) for s in (0, 3, 4, 7, 8, 11, 12, 14, 15)], choke=True)
    k_ind = industrial_kick()
    industrial = mix(normalize(render(bpm, 1, [(s, k_ind) for s in range(0, 16, 4)], choke=True)), render(bpm, 1, [(s, grit, 0.6) for s in (2, 5, 6, 10, 13, 14)]), render(bpm, 1, [(s, metal(int(0.05 * SR)) * 0.5) for s in range(1, 16, 2)]))
    speed_roll = render(bpm, 1, [(s, k_speed) for s in range(16)], choke=True)
    snare_fill = render(bpm, 1, [(s, sn, 0.3 + 0.7 * s / 15) for s in range(16)] +
                        [(s + 0.5, sn, 0.3 + 0.7 * s / 15) for s in range(8, 16)])

    four = lambda loop: np.tile(loop, 4)
    bank = [
        # rangée 1 : kicks plus durs
        ('Terror', RED, ONESHOT, k_terror, None),
        ('Uptempo', RED, ONESHOT, k_up, None),
        ('Speedcore', RED, ONESHOT, k_speed, None),
        ('Industrial', ORANGE, ONESHOT, industrial_kick(), None),
        ('Crunch', ORANGE, ONESHOT, gabber_kick(F - 2, drive=45, crush=5, asym=0.5, lp=4000), None),
        ('Mainstream', RED, ONESHOT, mainstream_kick(), None),
        ('Dark punch', ORANGE, ONESHOT, tail_kick(F - 3, drive=30, zaag=0.3, tail=0.35, formant=800, bite=8), None),
        ('Long tail', RED, ONESHOT, gabber_kick(F, drive=40, tail=1.6, dur=2.0), None),
        # rangée 2 : basses (fa mineur)
        *[(f'Bass {nm}', BLUE, ONESHOT, hc_bass(n, 0.5), None)
          for nm, n in zip(['F', 'G', 'G#', 'A#', 'C', 'C#', 'D#', 'F+'], [41, 43, 44, 46, 48, 49, 51, 53])],
        # rangée 3 : cordes
        *[(f'Strings {c}', VIOLET, HOLD, strings(chords[c]), None) for c in ['Fm', 'Db', 'Eb', 'Cm', 'Bbm', 'Ab']],
        ('Staccato Fm', PINK, ONESHOT, staccato(chords['Fm'], 0.2), None),
        ('Orchestra hit', PINK, ONESHOT, orchestra_hit(), None),
        # rangée 4 : boucles cordes et basses
        ('String ostinato', CYAN, LOOP, normalize(ostinato), 2),
        ('String pads', CYAN, LOOP, normalize(pads), 4),
        ('Offbeat bass', BLUE, LOOP, normalize(off_bass), 1),
        ('Rolling bass', BLUE, LOOP, normalize(roll_bass), 1),
        ('Reese bass', BLUE, LOOP, normalize(reese_loop), 2),
        ('Bass + kick', BLUE, LOOP, mix(kick_loop, off_bass), 1),
        ('Strings + beat', CYAN, LOOP, mix(four(kick_loop), four(offhat), pads), 4),
        ('Full track', CYAN, LOOP, mix(four(kick_loop), prog_bass, pads, np.tile(ostinato, 2) * 0.6, four(hats16) * 0.7), 4),
        # rangée 5 : boucles de batterie hardcore
        ('Terror loop', GREEN, LOOP, normalize(terror), 1),
        ('Kick gallop', GREEN, LOOP, normalize(gallop), 1),
        ('Industrial loop', GREEN, LOOP, industrial, 1),
        ('Speed roll', GREEN, LOOP, normalize(speed_roll), 1),
        ('Hard beat', GREEN, LOOP, mix(kick_loop, offhat, claps, hats16), 1),
        ('Terror gallop', GREEN, LOOP, normalize(render(bpm, 1, [(s, k_terror) for s in (0, 3, 4, 7, 8, 11, 12, 14, 15)], choke=True)), 1),
        ('Snare fill', YELLOW, LOOP, normalize(snare_fill), 1),
        ('Breakdown hit', WHITE, ONESHOT, layer(orchestra_hit(), impact(), 0.6), None),
    ]
    return bank


# ---------------------------------------------------------------- mainstream et nouvelle vague

def tail_kick(note=41, drive=14, tail=0.45, dur=0.7, bend=0.3, zaag=0.0, formant=1100, bite=6,
              punch_drive=60, click=1.0, top=0.8, screech=0.0):
    """Kick moderne : attaque courte et claquante + queue tonale distordue, accordée sur `note`.
    bend : chute de hauteur de la queue (en octaves sur la durée) ; zaag : part de scie dans la queue
    (son « râpeux ») ; screech : formant résonant qui balaie la queue de haut en bas."""
    t = t_of(dur)
    f = hz(note + 12) * (1 + 1.5 * np.exp(-t / 0.018)) * 2 ** (-bend * t / dur)
    osc = np.sin(2 * np.pi * np.cumsum(f) / SR)
    if zaag:
        osc = (1 - zaag) * osc + zaag * saw(f, len(t))
    env = exp_env(t, tail, hold=0.05) * np.clip((t - 0.01) / 0.012, 0, 1)
    # Saturation asymétrique sans composante continue quand la queue s'éteint.
    x = np.tanh(drive * (osc + 0.25) * env) - np.tanh(drive * 0.25 * env)
    if screech:
        x = x * (1 - screech) + screech * np.tanh(4 * sweep(x, 'bp', 3200 * np.exp(-t / (dur / 2.5)) + 350, 5))
    x = biquad(x, 'peak', formant, 1.0, bite)
    x = biquad(biquad(x, 'lp', 6500, 0.8), 'hp', 35)
    x = normalize(x)
    if top:
        x = x + top * gabber_kick(note + 12, drive=punch_drive, decay=0.02, tail=0.035, dur=dur, lp=11000, click=click)
    return fade(normalize(x), fout=0.03)


VOWEL_E = ((530, 1.0, 8), (1850, 0.6, 10), (2500, 0.3, 10))
VOWEL_I = ((300, 1.0, 8), (2300, 0.5, 10), (3000, 0.3, 10))
VOWEL_U = ((320, 1.0, 8), (870, 0.35, 9), (2240, 0.1, 10))


def shout(vowels, note=52, dur=0.45, drive=4, breath=0.5):
    """Cri synthétique (« hey », « oi »…) : source rauque + souffle dans des formants qui passent d'une voyelle à l'autre."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(note + 2 * np.exp(-t / 0.05) - 1.5 * t / dur)
    src = saw(f, n) + 0.6 * saw(f * 1.012, n) + breath * noise(n) * (0.3 + 0.7 * np.exp(-t / 0.04))
    pos = np.clip(t / dur * 1.4, 0, 1) * (len(vowels) - 1)
    idx = range(len(vowels))
    x = np.zeros(n)
    for j in range(3):
        fr = np.interp(pos, idx, [v[j][0] for v in vowels])
        g = np.interp(pos, idx, [v[j][1] for v in vowels])
        x += g * sweep(src, 'bp', fr, vowels[0][j][2])
    x = np.tanh(drive * normalize(x)) * adsr(n, 0.004, 0.1, 0.9, 0.08, dur - 0.08)
    return fade(normalize(reverb(x, 0.6, 0.15)), fout=0.05)


def bell(notes, dur=2.5, ratio=3.5, index=4.0, verb=0.4):
    """Cloche FM sombre (mélodies « horreur »)."""
    t = t_of(dur)
    x = np.zeros(len(t))
    for nt in notes:
        f = hz(nt)
        mod = index * np.exp(-t / 0.4) * np.sin(2 * np.pi * f * ratio * t)
        x += np.sin(2 * np.pi * f * t + mod) * exp_env(t, dur / 3) + 0.3 * np.sin(np.pi * f * t) * exp_env(t, dur / 2)
    return fade(normalize(reverb(x * np.clip(t / 0.002, 0, 1), 2.0, verb)), fout=0.2)


def dark_lead(note, dur=0.6, bend=0.0, bend_time=0.04, drive=5, cutoff=3500):
    """Lead sombre et saturé : scies désaccordées + sous-octave ; bend < 0 = attaque par en dessous."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = note + bend * np.exp(-t / bend_time)
    x = sum(saw(hz(p + c / 100), n) for c in (-18, -9, 0, 9, 18)) + 0.8 * saw(hz(p - 12), n)
    x = np.tanh(drive * biquad(x / 6, 'lp', cutoff, 1.2))
    x = biquad(biquad(x, 'peak', 2200, 1.0, 4), 'lp', 8000)
    return fade(normalize(x * adsr(n, 0.003, 0.2, 0.8, 0.06, dur - 0.06)), fout=0.01)


def supersaw(notes, dur=1.5, attack=0.01, release=0.4, cutoff=6000, verb=0.3, pluck=False):
    """Supersaw : 9 scies désaccordées par note + sous-octave ; pluck = filtre qui se referme vite."""
    n = int((dur + release) * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for nt in notes:
        for c in (-35, -24, -14, -6, 0, 6, 14, 24, 35):
            x += saw(hz(nt + c / 100), n)
    x += 0.5 * len(notes) * saw(hz(min(notes) - 12), n)
    x = chorus(x / (9.5 * len(notes)), depth_ms=6, rate=0.3)
    x = sweep(x, 'lp', 400 + cutoff * np.exp(-t / 0.09), 1.2) if pluck else biquad(x, 'lp', cutoff, 0.8)
    x = np.tanh(1.5 * biquad(x, 'hp', 150)) * adsr(n, attack, 0.3 if pluck else 0.5, 0.35 if pluck else 0.85, release, dur)
    return fade(normalize(reverb(fade(x), 1.8, verb)), fout=0.2)


def uplifter(dur=4.0):
    """Montée : bruit filtré et scies qui grimpent de deux octaves, de plus en plus fort."""
    t = t_of(dur)
    x = sweep(noise(len(t)), 'bp', 300 * (25 ** (t / dur)), 2.5)
    x += 0.5 * sum(saw(hz(53 + 24 * (t / dur) ** 1.5 + c / 100), len(t)) for c in (-15, 0, 15)) / 3
    x = biquad(x, 'hp', 200) * (t / dur) ** 1.5
    return fade(normalize(np.tanh(2 * x)), fout=0.01)


def tunnel(dur=2.5):
    """Souffle en balayage lent (« tunnel ») pour les transitions."""
    t = t_of(dur)
    x = sweep(noise(len(t)), 'bp', 900 + 700 * np.sin(2 * np.pi * 0.6 * t), 6)
    return fade(normalize(np.tanh(3 * x) * adsr(len(t), 0.4, 1, 1, 0.6)), fout=0.2)


def glitch(k, bpm):
    """Bégaiement de kick sur une mesure : croches, puis doubles, puis triples croches."""
    bar = int(round(240 / bpm * SR))
    out = np.zeros(bar)
    pos = 0
    for div in [8] * 4 + [16] * 4 + [32] * 8:
        size = bar // div
        chunk = fade(k[:size], fout=0.003)
        out[pos:pos + len(chunk)] += chunk[:bar - pos]
        pos += size
    return normalize(out)


def build_mainstream(bpm=190):
    """Mainstream hardcore sombre : kicks à queue tonale, leads saturés, cris, cloches, nappes en fa mineur harmonique."""
    reseed('Mainstream')
    RED, ORANGE, YELLOW, GREEN, CYAN, BLUE, VIOLET, MAGENTA, PINK, WHITE = 5, 9, 13, 21, 37, 41, 49, 53, 57, 3
    ONESHOT, HOLD, LOOP = 0, 1, 2
    step = step_len(bpm)
    bar = 16

    k_main = tail_kick(F)
    cl = layer(clap(8), snare(8), 0.5)
    oh = hat(0.2, 5)
    hh = hat(0.04, 4)

    # Fa mineur harmonique (mi naturel) : la couleur sombre du mainstream.
    chords = {'Fm': [53, 56, 60, 65], 'Db': [49, 53, 56, 61], 'Bbm': [46, 53, 58, 61], 'C': [48, 52, 55, 60]}
    prog = ['Fm', 'Db', 'Bbm', 'C']

    kick_loop = normalize(render(bpm, 1, [(s, k_main) for s in range(0, 16, 4)], choke=True))
    claps = render(bpm, 1, [(4, cl, 0.6), (12, cl, 0.6)])
    offhat = render(bpm, 1, [(s, oh, 0.45) for s in range(2, 16, 4)])
    hats16 = render(bpm, 1, [(s, hh, 0.25 if s % 2 else 0.12) for s in range(16)])
    beat = mix(kick_loop, claps, offhat)

    riff = [(0, 65), (2, 65), (4, 68), (6, 67), (8, 65), (10, 64), (12, 65), (14, 72),
            (16, 70), (18, 68), (20, 67), (22, 68), (24, 67), (26, 65), (28, 64), (30, 67)]
    lead_riff = render(bpm, 2, [(s, dark_lead(n, step * 1.8), 0.85) for s, n in riff], choke=True)
    scr = [(0, 77), (6, 76), (8, 77), (14, 80), (16, 79), (22, 77), (24, 76), (30, 72)]
    screech_riff = render(bpm, 2, [(s, screech(n, step * 5.5, rate=bpm / 20)) for s, n in scr], choke=True)
    bell_notes = [(0, 77), (4, 76), (8, 77), (12, 80), (16, 79), (20, 77), (24, 76), (28, 73)]
    bell_mel = render(bpm, 2, [(s, bell([n], step * 6, verb=0.25), 0.8) for s, n in bell_notes])
    pads = render(bpm, 4, [(b * bar, strings(chords[c], dur=step * bar, attack=0.3, release=0.6, bright=2000))
                           for b, c in enumerate(prog)])
    build_up = render(bpm, 4, [(s, fade(k_main[:int(step * 4 * SR)], fout=0.01), 0.55 + 0.45 * s / 64) for s in
                               list(range(0, 32, 4)) + list(range(32, 48, 2)) + list(range(48, 64))], choke=True)
    build_up = mix(build_up, riser(240 / bpm * 4) * 0.6)

    bank = [
        # rangée 1 : kicks à queue tonale
        ('Mainstream F', RED, ONESHOT, k_main, None),
        ('Angry', RED, ONESHOT, tail_kick(F, drive=25, bite=9, formant=1500), None),
        ('Dark tail', ORANGE, ONESHOT, tail_kick(F - 2, drive=12, tail=0.6, dur=0.9, formant=700), None),
        ('Punchy', RED, ONESHOT, tail_kick(F, tail=0.25, dur=0.45, punch_drive=80), None),
        ('Pitch drop', ORANGE, ONESHOT, tail_kick(F, bend=1.0, tail=0.5), None),
        ('Raw zaag', RED, ONESHOT, tail_kick(F, zaag=0.5, drive=10), None),
        ('Kick C#', ORANGE, ONESHOT, tail_kick(37), None),
        ('Kick G#', ORANGE, ONESHOT, tail_kick(44), None),
        # rangée 2 : percussions
        ('Hard clap', YELLOW, ONESHOT, cl, None),
        ('Snare', YELLOW, ONESHOT, snare(8), None),
        ('Open hat', YELLOW, ONESHOT, oh, None),
        ('Closed hat', YELLOW, ONESHOT, hh, None),
        ('Tom hit', YELLOW, ONESHOT, tom(), None),
        ('Crash', YELLOW, ONESHOT, crash(), None),
        ('Sub drop', WHITE, ONESHOT, sub_drop(), None),
        ('Industrial hit', WHITE, ONESHOT, layer(noise_hit(), industrial_kick(), 0.5), None),
        # rangée 3 : leads, cloches, piano
        ('Dark lead', MAGENTA, HOLD, dark_lead(65, 1.2), None),
        ('Scream lead', MAGENTA, HOLD, dark_lead(65, 1.2, bend=-12, bend_time=0.15, drive=8), None),
        ('Screech', MAGENTA, HOLD, screech(77, 1.4, rate=9), None),
        ('Screech low', MAGENTA, HOLD, screech(65, 1.4, rate=5), None),
        ('Hoover dark', VIOLET, HOLD, hoover(53, 1.4), None),
        ('Horror bell', PINK, ONESHOT, bell([77]), None),
        ('Bell chord', PINK, ONESHOT, bell([65, 68, 72]), None),
        ('Dark piano', PINK, ONESHOT, rave_piano([41, 53, 56, 60], 2.0, verb=0.4), None),
        # rangée 4 : cris, nappes, effets
        ('Shout hey', CYAN, ONESHOT, shout([VOWEL_E, VOWEL_I]), None),
        ('Shout oi', CYAN, ONESHOT, shout([VOWEL_O, VOWEL_I], 50), None),
        ('Shout yeah', CYAN, ONESHOT, shout([VOWEL_I, VOWEL_E, VOWEL_A], 51, 0.6), None),
        ('Dark choir', CYAN, HOLD, choir([41, 48, 53, 56], vowel=VOWEL_O), None),
        ('Dark strings', VIOLET, HOLD, strings(chords['Fm'], bright=2000), None),
        ('Horror pad', VIOLET, HOLD, strings([52, 53, 60, 61], bright=1600, verb=0.5), None),
        ('Riser', WHITE, ONESHOT, riser(), None),
        ('Impact', WHITE, ONESHOT, impact(), None),
        # rangée 5 : boucles
        ('Mainstream beat', GREEN, LOOP, beat, 1),
        ('Mainstream gallop', GREEN, LOOP, mix(normalize(render(bpm, 1, [(s, k_main) for s in (0, 3, 4, 7, 8, 11, 12, 14, 15)], choke=True)), claps, hats16), 1),
        ('Lead riff', MAGENTA, LOOP, normalize(lead_riff), 2),
        ('Screech riff', MAGENTA, LOOP, normalize(screech_riff), 2),
        ('Bell melody', PINK, LOOP, normalize(bell_mel), 2),
        ('Breakdown pad', VIOLET, LOOP, normalize(pads), 4),
        ('Build-up', GREEN, LOOP, build_up, 4),
        ('Full track', GREEN, LOOP, mix(np.tile(beat, 4), np.tile(lead_riff, 2) * 0.7, pads * 0.5), 4),
    ]
    return bank


def build_newwave(bpm=190):
    """Hardcore nouvelle vague / uptempo : kicks à longue queue « zaag », mélodies de kicks, supersaws, plucks."""
    reseed('New wave')
    RED, ORANGE, YELLOW, GREEN, CYAN, BLUE, VIOLET, MAGENTA, PINK, WHITE = 5, 9, 13, 21, 37, 41, 49, 53, 57, 3
    ONESHOT, HOLD, LOOP = 0, 1, 2
    step = step_len(bpm)
    bar = 16

    up = dict(drive=18, zaag=0.7, tail=0.5, formant=1400, bite=8, punch_drive=90)
    tuned = {n: tail_kick(n, **up) for n in (41, 43, 44, 46, 36, 37, 39, 53)}
    k_up = tail_kick(F, drive=22, zaag=0.8, tail=0.55, formant=1600, bite=9, punch_drive=100, click=1.3)   # différent du « Kick F » accordé
    k_bass = tail_kick(F, drive=16, zaag=0.6, tail=0.12, dur=0.3, top=0)   # queue seule : basse entre les kicks
    oh = hat(0.15, 4)
    chords = {'Fm': [65, 68, 72], 'Db': [61, 65, 68], 'Ab': [60, 63, 68], 'Eb': [63, 67, 70]}
    prog = ['Fm', 'Db', 'Ab', 'Eb']

    kick_loop = normalize(render(bpm, 1, [(s, k_up) for s in range(0, 16, 4)], choke=True))
    offhat = render(bpm, 1, [(s, oh, 0.4) for s in range(2, 16, 4)])
    beat = mix(kick_loop, offhat)
    kick_bass = normalize(render(bpm, 1, [(s, k_up) for s in range(0, 16, 4)] + [(s, k_bass, 0.8) for s in (2, 6, 10, 14)], choke=True))
    melody = [41, 41, 44, 41, 37, 37, 39, 36]
    kick_mel = normalize(render(bpm, 2, [(i * 4, tuned[n]) for i, n in enumerate(melody)], choke=True))
    gallop = normalize(render(bpm, 1, [(s, k_up) for s in (0, 3, 4, 7, 8, 11, 12, 14, 15)], choke=True))
    saw_chords = render(bpm, 4, [(b * bar, supersaw(chords[c], dur=step * bar - 0.05, attack=0.02, release=0.3))
                                 for b, c in enumerate(prog)], choke=True)
    pl = [77, 75, 72, 75, 77, 80, 79, 75, 73, 72, 68, 72, 75, 72, 70, 67]
    plucks = {n: supersaw([n], step * 1.4, release=0.15, verb=0.15, pluck=True) for n in sorted(set(pl))}
    pluck_mel = render(bpm, 2, [(i * 2, plucks[n], 0.9) for i, n in enumerate(pl)])
    build_up = render(bpm, 4, [(s, fade(k_up[:int(step * 4 * SR)], fout=0.01), 0.5 + 0.5 * s / 64) for s in
                               list(range(0, 32, 4)) + list(range(32, 48, 2)) + list(range(48, 60)) + [60 + i / 2 for i in range(8)]],
                      choke=True)
    build_up = mix(build_up, uplifter(240 / bpm * 4) * 0.7)

    bank = [
        # rangée 1 : kicks uptempo
        ('Uptempo F', RED, ONESHOT, k_up, None),
        ('Zaag', RED, ONESHOT, tail_kick(F, drive=22, zaag=1.0, tail=0.55, formant=1800, bite=9, punch_drive=90), None),
        ('Raw', ORANGE, ONESHOT, tail_kick(F, drive=20, zaag=0.4, bend=0.8, tail=0.45, formant=900), None),
        ('Screech kick', RED, ONESHOT, tail_kick(F, drive=18, zaag=0.6, screech=0.7, tail=0.5), None),
        ('Hard punch', ORANGE, ONESHOT, tail_kick(F, drive=14, tail=0.15, dur=0.35, punch_drive=110, click=1.5), None),
        ('Long zaag', RED, ONESHOT, tail_kick(F, drive=18, zaag=0.8, tail=1.2, dur=1.6, bend=0.6), None),
        ('Hard tok', ORANGE, ONESHOT, tail_kick(F + 5, drive=16, tail=0.2, dur=0.4, zaag=0.3, punch_drive=110, click=1.6, top=1), None),
        ('Kick-bass', BLUE, ONESHOT, k_bass, None),
        # rangée 2 : kicks accordés pour les mélodies de kicks
        *[(f'Kick {nm}', RED, ONESHOT, tuned[n], None)
          for nm, n in zip(['F', 'G', 'G#', 'A#', 'C', 'C#', 'D#', 'F+'], [41, 43, 44, 46, 36, 37, 39, 53])],
        # rangée 3 : supersaws et leads
        ('Supersaw lead', MAGENTA, HOLD, supersaw([77], 1.5), None),
        *[(f'Supersaw {c}', VIOLET, HOLD, supersaw(chords[c], 2.0, attack=0.02), None) for c in prog],
        ('Pluck', PINK, ONESHOT, supersaw([77], 0.25, release=0.2, pluck=True), None),
        ('Pitch lead', MAGENTA, HOLD, dark_lead(77, 1.2, bend=-5, bend_time=0.08, drive=3, cutoff=6000), None),
        ('Euphoric pad', CYAN, HOLD, supersaw([53, 60, 65, 68, 72], 3.0, attack=0.4, release=0.8, cutoff=3500, verb=0.5), None),
        # rangée 4 : cris et effets
        ('Shout go', CYAN, ONESHOT, shout([VOWEL_O, VOWEL_U], 53, 0.4), None),
        ('Shout hey', CYAN, ONESHOT, shout([VOWEL_E, VOWEL_I], 55), None),
        ('Uplifter', WHITE, ONESHOT, uplifter(), None),
        ('Tape stop', WHITE, ONESHOT, tape_stop_loop(np.tile(kick_bass, 2)), None),
        ('Tunnel', WHITE, HOLD, tunnel(), None),
        ('Glitch', WHITE, ONESHOT, glitch(k_up, bpm), None),
        ('Reverse kick', ORANGE, ONESHOT, normalize(k_up[::-1]), None),
        ('Pitch riser', WHITE, ONESHOT, pitch_riser(), None),
        # rangée 5 : boucles
        ('Uptempo beat', GREEN, LOOP, beat, 1),
        ('Kick-bass loop', GREEN, LOOP, kick_bass, 1),
        ('Kick melody', GREEN, LOOP, kick_mel, 2),
        ('Gallop', GREEN, LOOP, gallop, 1),
        ('Supersaw chords', VIOLET, LOOP, normalize(saw_chords), 4),
        ('Pluck melody', PINK, LOOP, normalize(pluck_mel), 2),
        ('Build-up', GREEN, LOOP, build_up, 4),
        ('Full drop', GREEN, LOOP, mix(np.tile(kick_bass, 4), np.tile(offhat, 4), saw_chords * 0.5, np.tile(pluck_mel, 2) * 0.5), 4),
    ]
    return bank


# ---------------------------------------------------------------- sons ajoutés au ménage des doublons

def tom(note=45, drive=5, dur=0.45):
    """Tom saturé : sinus qui tombe, peau bruitée."""
    t = t_of(dur)
    x = sine_sweep(hz(note) * (1 + 0.9 * np.exp(-t / 0.03))) * exp_env(t, dur / 3)
    x += biquad(noise(len(t)), 'bp', 900, 1.2) * exp_env(t, 0.02) * 0.4
    return fade(normalize(np.tanh(drive * x)), fout=0.03)


def shaker(dur=0.18):
    t = t_of(dur)
    x = biquad(biquad(noise(len(t)), 'hp', 6000), 'bp', 9000, 1.5)
    x *= np.clip(t / 0.02, 0, 1) * exp_env(t, 0.05, 0.02)
    return fade(normalize(x))


def cowbell808(dur=0.5):
    """Cowbell façon 808 : deux carrés désaccordés dans un passe-bande."""
    t = t_of(dur)
    x = np.sign(np.sin(2 * np.pi * 540 * t)) + np.sign(np.sin(2 * np.pi * 800 * t))
    x = biquad(x, 'bp', 2600, 3) * (exp_env(t, 0.02) * 0.6 + exp_env(t, 0.18) * 0.4)
    return fade(normalize(x), fout=0.02)


def sub_drop(dur=2.5, note=29):
    """Sub drop : sinus grave qui plonge, pour marquer l'arrivée d'un drop."""
    t = t_of(dur)
    f = hz(note + 24) * np.power(0.25, t / dur)
    x = np.tanh(1.5 * sine_sweep(f)) * adsr(len(t), 0.005, 0.5, 0.9, 0.6)
    return fade(normalize(x), fout=0.3)


def pitch_riser(dur=3.0):
    """Montée de hauteur : scies désaccordées qui grimpent de deux octaves, filtre qui s'ouvre."""
    t = t_of(dur)
    p = 53 + 24 * (t / dur) ** 1.6
    x = sum(saw(hz(p + c / 100), len(t)) for c in (-20, 0, 20)) / 3
    x = sweep(x, 'lp', 400 * (30 ** (t / dur)), 2) * (t / dur) ** 1.2
    return fade(normalize(np.tanh(2 * x)), fout=0.02)


def tape_stop_loop(loop, dur=None):
    """Tape stop : la boucle ralentit jusqu'à l'arrêt, comme une bande qui freine."""
    n = len(loop) if dur is None else int(dur * SR)
    rate = np.linspace(1, 0, n) ** 0.8
    pos = np.cumsum(rate)
    pos = pos[pos < len(loop) - 1]
    i = pos.astype(int)
    f = pos - i
    x = loop[i] * (1 - f) + loop[i + 1] * f
    return fade(normalize(x), fout=0.05)


def air_horn(note=81, dur=0.9):
    """Air horn : trois coups de corne saturés qui retombent (le classique des drops hardstyle)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, t0 in enumerate((0, 0.12, 0.24)):
        m = t >= t0
        u = t[m] - t0
        l = 0.1 if k < 2 else dur - 0.24
        p = note - 1.2 * np.clip(u / l, 0, 1) - (6 * np.clip((u - l) / 0.2, 0, 1) if k == 2 else 0)
        env = np.clip(u / 0.004, 0, 1) * np.where(u < l, 1, np.exp(-(u - l) / 0.05))
        x[m] += sum(saw(hz(p + c / 100), m.sum()) for c in (-15, 0, 15, 1200)) * env
    x = np.tanh(3 * biquad(biquad(x / 4, 'peak', 1800, 1, 8), 'lp', 7000))
    return fade(normalize(reverb(x, 0.8, 0.2)), fout=0.1)


# ---------------------------------------------------------------- hardstyle / rawstyle (150 BPM)

def reverse_bass(note=41, length=0.3, drive=18):
    """Reverse bass du hardstyle : la queue d'un kick jouée à l'envers, qui gonfle jusqu'au kick suivant."""
    tail = tail_kick(note, drive=drive, zaag=0.35, tail=length * 0.6, dur=length, bend=0.25, top=0)
    x = tail[::-1].copy()
    return fade(normalize(x), fin=0.004, fout=0.004)


def raw_screech(note=77, dur=1.2, rate=9):
    """Screech rawstyle : scies saturées, formant qui balaie vite, hauteur qui tremble."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    bend = -5 * np.exp(-t / 0.06)
    f = hz(note + bend) * (1 + 0.045 * np.sin(2 * np.pi * rate * t))
    x = saw(f, n) + saw(f * 1.01, n) + 0.6 * saw(f * 0.5, n)
    fc = 1200 + 2200 * (0.5 + 0.5 * np.sin(2 * np.pi * rate * 0.5 * t)) + 1500 * (t / dur)
    x = sweep(x, 'bp', fc, 7)
    x = np.tanh(18 * x)
    x = biquad(biquad(x, 'lp', 8000), 'hp', 120)
    return fade(normalize(x * adsr(n, 0.005, 0.2, 0.9, 0.08, dur - 0.08)))


def build_hardstyle(bpm=150):
    """Hardstyle / rawstyle (à 150 BPM) : kicks raw à queue screech, reverse bass, screeches, leads euphoriques."""
    reseed('Hardstyle')
    RED, ORANGE, YELLOW, GREEN, CYAN, BLUE, VIOLET, MAGENTA, PINK, WHITE = 5, 9, 13, 21, 37, 41, 49, 53, 57, 3
    ONESHOT, HOLD, LOOP = 0, 1, 2
    step = step_len(bpm)
    bar = 16
    beat = step * 4

    hard = dict(drive=20, zaag=0.25, tail=0.45, dur=0.8, bend=0.45, formant=1250, bite=8, punch_drive=95, click=1.3, top=1)
    raw = dict(drive=28, zaag=0.55, screech=0.55, tail=0.5, dur=0.85, bend=0.6, formant=1000, bite=10, punch_drive=100, click=1.4, top=1)
    k_hard = tail_kick(F, **hard)
    k_raw = tail_kick(F, **raw)
    rb = {n: reverse_bass(n, step * 3) for n in (41, 37, 39, 44)}
    cl = layer(clap(5), snare(4), 0.4)
    cl_big = normalize(reverb(cl, 1.6, 0.35))[:int(0.9 * SR)]
    hh = hat(0.05, 3)
    oh = hat(0.16, 3)
    chords = {'Fm': [65, 68, 72], 'Db': [61, 65, 68], 'Ab': [60, 63, 68], 'Eb': [63, 67, 70]}
    prog = ['Fm', 'Db', 'Ab', 'Eb']
    roots = [41, 37, 44, 39]

    kick_loop = normalize(render(bpm, 1, [(s, k_hard) for s in range(0, 16, 4)], choke=True))
    offhat = render(bpm, 1, [(s, oh, 0.4) for s in range(2, 16, 4)])
    claps = render(bpm, 1, [(4, cl, 0.6), (12, cl, 0.6)])
    beat_loop = mix(kick_loop, offhat, claps)
    # Le groove du hardstyle : kick sur le temps, reverse bass qui gonfle jusqu'au kick suivant.
    rev = lambda root: [(s, k_hard) for s in range(0, 16, 4)] + [(s + 1, rb[root], 0.85) for s in range(0, 16, 4)]
    revbass = normalize(render(bpm, 1, rev(41), choke=True))
    revbass_prog = normalize(render(bpm, 4, [(b * bar + s, x, *g) for b, r in enumerate(roots) for s, x, *g in rev(r)], choke=True))
    raw_loop = normalize(render(bpm, 1, [(s, k_raw) for s in (0, 4, 8, 12, 14, 15)], choke=True))
    build = render(bpm, 4, [(s, fade(k_hard[:int(beat * SR)], fout=0.01), 0.5 + 0.5 * s / 64) for s in
                            list(range(0, 32, 4)) + list(range(32, 48, 2)) + list(range(48, 64))], choke=True)
    build = mix(build, pitch_riser(240 / bpm * 4) * 0.6)
    scr = [(0, 77), (3, 77), (6, 80), (8, 77), (11, 75), (14, 72), (16, 77), (19, 77), (22, 80), (24, 82), (27, 80), (30, 77)]
    screech_riff = render(bpm, 2, [(s, raw_screech(n, step * 2.6, rate=bpm / 16)) for s, n in scr], choke=True)
    mel = [(0, 77, 4), (4, 75, 2), (6, 72, 2), (8, 73, 4), (12, 72, 2), (14, 70, 2),
           (16, 72, 4), (20, 70, 2), (22, 68, 2), (24, 70, 6), (30, 72, 2)]
    lead = render(bpm, 2, [(s, supersaw([n], step * d - 0.02, attack=0.005, release=0.12, cutoff=7000, verb=0.2), 0.9) for s, n, d in mel], choke=True)
    lead4 = np.tile(lead, 2)
    pads = render(bpm, 4, [(b * bar, supersaw([n - 12 for n in chords[c]], step * bar - 0.05, attack=0.2, release=0.3, cutoff=3000, verb=0.4), 0.7)
                           for b, c in enumerate(prog)], choke=True)
    pl = [77, 72, 68, 72, 77, 72, 68, 72, 73, 68, 65, 68, 75, 70, 67, 70]
    plucks = {n: supersaw([n], step * 1.2, release=0.12, verb=0.15, pluck=True) for n in sorted(set(pl))}
    pluck_mel = render(bpm, 2, [(i * 2, plucks[n], 0.9) for i, n in enumerate(pl)])

    bank = [
        # rangée 1 : kicks hardstyle et rawstyle
        ('Hardstyle kick', RED, ONESHOT, k_hard, None),
        ('Raw kick', RED, ONESHOT, k_raw, None),
        ('Screech kick', RED, ONESHOT, tail_kick(F, drive=26, zaag=0.4, screech=0.9, tail=0.5, dur=0.85, bend=0.5, formant=1500, bite=9, punch_drive=95, top=1), None),
        ('Euphoric kick', ORANGE, ONESHOT, tail_kick(F, drive=12, zaag=0, tail=0.4, dur=0.7, bend=0.35, formant=900, bite=5, punch_drive=85, top=0.9), None),
        ('Zaag raw kick', RED, ONESHOT, tail_kick(F, drive=30, zaag=0.9, tail=0.55, dur=0.9, bend=0.7, formant=1100, bite=10, punch_drive=100, top=1), None),
        ('Punch kick', ORANGE, ONESHOT, tail_kick(F, drive=18, tail=0.18, dur=0.4, bend=0.3, punch_drive=120, click=1.6, top=1), None),
        ('Kick C#', ORANGE, ONESHOT, tail_kick(37, **hard), None),
        ('Kick G#', ORANGE, ONESHOT, tail_kick(44, **hard), None),
        # rangée 2 : reverse bass et percussions
        ('Reverse bass F', BLUE, ONESHOT, rb[41], None),
        ('Reverse bass C#', BLUE, ONESHOT, rb[37], None),
        ('Reverse bass D#', BLUE, ONESHOT, rb[39], None),
        ('Reverse bass G#', BLUE, ONESHOT, rb[44], None),
        ('Hardstyle clap', YELLOW, ONESHOT, cl_big, None),
        ('Snare hit', YELLOW, ONESHOT, snare(6), None),
        ('Open hat', YELLOW, ONESHOT, oh, None),
        ('China crash', YELLOW, ONESHOT, fade(normalize(biquad(np.tanh(4 * crash()), 'bp', 5000, 0.8)), fout=0.2), None),
        # rangée 3 : screeches, leads, plucks
        ('Raw screech', MAGENTA, HOLD, raw_screech(77, 1.4), None),
        ('Raw screech low', MAGENTA, HOLD, raw_screech(65, 1.4, rate=6), None),
        ('Euphoric lead', VIOLET, HOLD, supersaw([77], 1.6, attack=0.01, cutoff=7000), None),
        ('Euphoric chord', VIOLET, HOLD, supersaw(chords['Fm'], 2.0, attack=0.02, cutoff=6000), None),
        ('Hardstyle pluck', PINK, ONESHOT, supersaw([77], 0.25, release=0.15, pluck=True), None),
        ('Pitch lead', MAGENTA, HOLD, dark_lead(77, 1.0, bend=-12, bend_time=0.2, drive=6, cutoff=5000), None),
        ('Raw stab', PINK, ONESHOT, stab([65, 68, 72], dur=0.4, drive=6, verb=0.25), None),
        ('Hoover raw', VIOLET, HOLD, hoover(65, 1.3), None),
        # rangée 4 : cris et effets
        ('Shout hey', CYAN, ONESHOT, shout([VOWEL_E, VOWEL_I], 48, 0.5, drive=6), None),
        ('Shout raw', CYAN, ONESHOT, shout([VOWEL_A, VOWEL_O], 46, 0.55, drive=7), None),
        ('Shout go', CYAN, ONESHOT, shout([VOWEL_O, VOWEL_U], 50, 0.45, drive=6), None),
        ('Pitch riser', WHITE, ONESHOT, pitch_riser(240 / bpm * 4), None),
        ('Uplifter', WHITE, ONESHOT, uplifter(240 / bpm * 4), None),
        ('Deep sub drop', WHITE, ONESHOT, sub_drop(3.5, note=24), None),
        ('Impact', WHITE, ONESHOT, layer(impact(), sub_drop(1.5), 0.5), None),
        ('Air horn', WHITE, ONESHOT, air_horn(), None),
        # rangée 5 : boucles à 150 BPM
        ('Hardstyle beat', GREEN, LOOP, beat_loop, 1),
        ('Reverse bass loop', GREEN, LOOP, revbass, 1),
        ('Reverse bass prog', GREEN, LOOP, revbass_prog, 4),
        ('Rawstyle loop', GREEN, LOOP, raw_loop, 1),
        ('Kick build-up', GREEN, LOOP, build, 4),
        ('Screech riff', MAGENTA, LOOP, normalize(screech_riff), 2),
        ('Euphoric melody', VIOLET, LOOP, mix(lead4, pads * 0.6), 4),
        ('Full drop', GREEN, LOOP, mix(revbass_prog, np.tile(claps, 4) * 0.8, np.tile(offhat, 4) * 0.6, lead4 * 0.55, pads * 0.3), 4),
    ]
    return bank


# ---------------------------------------------------------------- mélodies (compositeur + deux banques)
# Un petit compositeur : un motif rythmique typique, décliné sur chaque accord d'une suite en visant les notes
# de l'accord sur les temps forts, avec une cadence sur la tonique. Chaque mélodie a sa graine : reproductible.

MINOR_PCS = [5, 7, 8, 10, 0, 1, 3]            # fa mineur : fa sol lab sib do réb mib
CHORD_NOTES = {'Fm': [65, 68, 72], 'Db': [61, 65, 68], 'Eb': [63, 67, 70], 'Cm': [60, 63, 67], 'Ab': [60, 63, 68],
               'Bbm': [61, 65, 70], 'C': [60, 64, 67], 'Gdim': [62, 65, 68]}
PROGS = {'epic': ['Fm', 'Db', 'Eb', 'Cm'], 'euphoric': ['Fm', 'Db', 'Ab', 'Eb'], 'dark': ['Fm', 'Bbm', 'Db', 'C'], 'andalusian': ['Fm', 'Eb', 'Db', 'C']}
ROOT_NOTE = {'Fm': 41, 'Db': 37, 'Eb': 39, 'Cm': 36, 'Ab': 44, 'Bbm': 46, 'C': 36, 'Gdim': 43}
# Rythmes d'une mesure : (pas de double-croche, durée en pas).
RHYTHMS = {
    'eighths': [(k, 2) for k in range(0, 16, 2)],
    'gabber': [(0, 3), (3, 3), (6, 2), (8, 3), (11, 3), (14, 2)],
    'anthem': [(0, 4), (4, 2), (6, 2), (8, 4), (12, 2), (14, 2)],
    'offbeat': [(2, 2), (6, 2), (10, 2), (14, 2)],
    'gallop': [(0, 1), (1, 2), (3, 1), (4, 1), (5, 2), (7, 1), (8, 1), (9, 2), (11, 1), (12, 1), (13, 2), (15, 1)],
    'sixteenths': [(k, 1) for k in range(16)],
    'long': [(0, 6), (6, 2), (8, 6), (14, 2)],
    'hook': [(0, 2), (2, 1), (3, 3), (6, 2), (8, 2), (10, 1), (11, 3), (14, 2)],
    'dotted': [(0, 3), (3, 3), (6, 3), (9, 3), (12, 4)],
}


def chord_pcs(name):
    return [n % 12 for n in CHORD_NOTES[name]]


def scale_pcs(name):
    # Sur l'accord de do majeur (mineur harmonique), le mib devient mi.
    return [4 if (name == 'C' and pc == 3) else pc for pc in MINOR_PCS]


def nearest(n, pcs, prefer=0):
    for d in (0, prefer or -1, -(prefer or -1), 1, -1, 2, -2, 3, -3):
        if (n + d) % 12 in pcs:
            return n + d
    return n


def scale_step(n, k, pcs):
    """Déplace la note de k degrés de la gamme."""
    ring = sorted(set(pcs))
    n = nearest(n, pcs)
    for _ in range(abs(k)):
        d = 1 if k > 0 else -1
        n += d
        while n % 12 not in ring:
            n += d
    return n


def compose(seed, prog, rhythm, lo=64, hi=84, bars=None, cadence=True):
    """Mélodie sur une suite d'accords (une mesure par accord) : liste de (pas, note, durée en pas)."""
    r = np.random.default_rng(seed)
    chords = PROGS[prog] if isinstance(prog, str) else prog
    if bars:
        chords = chords[:bars]
    rh = RHYTHMS[rhythm]
    contour = [0] + list(r.choice([-2, -1, 1, 2, 0, 3, -3], size=len(rh) - 1, p=[.16, .26, .24, .14, .08, .06, .06]))
    cur = int(r.choice([t for t in CHORD_NOTES[chords[0]] + [n + 12 for n in CHORD_NOTES[chords[0]]] if lo <= t <= hi] or [72]))
    out = []
    for b, name in enumerate(chords):
        pcs, tones = scale_pcs(name), chord_pcs(name)
        flip = -1 if b == 2 else 1   # 3e mesure : le motif est renversé (question / réponse)
        for i, (st, du) in enumerate(rh):
            if i == 0 and b > 0:
                cur = nearest(cur, tones)
            elif i > 0:
                cur = scale_step(cur, int(contour[i]) * flip, pcs)
            if st in (0, 8):
                cur = nearest(cur, tones)
            while cur > hi: cur -= 12
            while cur < lo: cur += 12
            out.append([b * 16 + st, cur, du])
    if cadence and out:
        # Cadence : la dernière note devient la tonique (ou la quinte) et tient jusqu'à la fin.
        last = out[-1]
        target = 65 if abs(last[1] - 65) <= abs(last[1] - 77) else 77
        if chords[-1] in ('C', 'Eb'):
            target = 72 if lo <= 72 <= hi else target   # sur la dominante : on reste sur do
        while target > hi: target -= 12
        while target < lo: target += 12
        last[1] = target
        last[2] = len(chords) * 16 - last[0]
    return [tuple(x) for x in out]


def arpeggio(prog, pattern=(0, 1, 2, 1), octave=12, per_bar=16):
    """Arpège des notes de chaque accord en doubles-croches."""
    out = []
    for b, name in enumerate(PROGS[prog]):
        notes = CHORD_NOTES[name] + [CHORD_NOTES[name][0] + 12]
        for k in range(per_bar):
            out.append((b * 16 + k, notes[pattern[k % len(pattern)]] + octave - 12, 1))
    return out


def _instrument(kind, bpm):
    """Fabrique d'un instrument : (note, durée en s) -> signal, avec cache des notes déjà calculées."""
    cache = {}
    make = {
        'hoover': lambda n, d: hoover(n, d, bend=False),
        'screech': lambda n, d: screech(n, max(d, 0.14), rate=bpm / 20),   # notes très courtes : l'enveloppe a besoin d'un minimum
        'rawscreech': lambda n, d: raw_screech(n, max(d, 0.14), rate=bpm / 16),
        'darklead': lambda n, d: dark_lead(n, max(d, 0.1)),
        'supersaw': lambda n, d: supersaw([n], d, attack=0.005, release=0.12, cutoff=7000, verb=0.18),
        'pluck': lambda n, d: supersaw([n], max(d, 0.12), release=0.12, verb=0.15, pluck=True),
        'piano': lambda n, d: rave_piano([n], max(d, 0.6), verb=0.2),
        'bells': lambda n, d: bell([n], max(d, 0.9), verb=0.25),
        'strings': lambda n, d: strings([n], d, attack=0.08, release=0.25, bright=4200, verb=0.25),
        'staccato': lambda n, d: staccato([n], min(d, 0.18), verb=0.15),
        'acid': lambda n, d: acid(n - 12, d, accent=0.8),
        'horn': lambda n, d: horn((n - 12, n - 5, n), max(d, 0.35)),
        'mentasm': lambda n, d: mentasm([n - 12, n], d),
        'choir': lambda n, d: choir([n], d, attack=0.05, release=0.3, verb=0.3),
        'stab': lambda n, d: stab([n, n + 3 if (n + 3) % 12 in MINOR_PCS else n + 4, n + 7], min(d, 0.35), verb=0.2),
    }[kind]

    def play(n, d):
        key = (n, round(d, 3))
        if key not in cache:
            cache[key] = make(n, d)
        return cache[key]
    return play


def melody_loop(bpm, notes, kind, bars, legato=0.95, gain=0.9, choke=True):
    step = step_len(bpm)
    inst = _instrument(kind, bpm)
    return normalize(render(bpm, bars, [(st, inst(n, du * step * legato), gain) for st, n, du in notes], choke=choke))


def chords_loop(bpm, prog, kind='pad', rhythm=None):
    """Accords de la suite : nappe tenue (supersaw, cordes, chœur) ou coups rythmés (stabs, piano)."""
    step = step_len(bpm)
    names = PROGS[prog]
    ev = []
    for b, c in enumerate(names):
        notes = [n - 12 for n in CHORD_NOTES[c]]
        if kind == 'pad':
            ev.append((b * 16, supersaw(notes, step * 16 - 0.05, attack=0.15, release=0.3, cutoff=3200, verb=0.4), 0.8))
        elif kind == 'strings':
            ev.append((b * 16, strings(notes, dur=step * 16, attack=0.2, release=0.5), 0.9))
        elif kind == 'choir':
            ev.append((b * 16, choir(notes, dur=step * 16, attack=0.25, release=0.5), 0.9))
        elif kind == 'piano':
            for st in (0, 3, 6, 10, 12):
                ev.append((b * 16 + st, rave_piano(notes, step * 3, verb=0.15), 0.9))
        else:   # stabs
            for st in (rhythm or (2, 6, 10, 14)):
                ev.append((b * 16 + st, stab(notes, dur=0.28, verb=0.15), 0.85))
    return normalize(render(bpm, len(names), ev, choke=kind in ('pad', 'strings', 'choir')))


def bass_line(bpm, prog, kind='offbeat'):
    step = step_len(bpm)
    ev = []
    for b, c in enumerate(PROGS[prog]):
        r = ROOT_NOTE[c]
        if kind == 'reese':
            ev.append((b * 16, reese(r, step * 16), 0.9))
        elif kind == 'reverse':
            for st in (1, 5, 9, 13):
                ev.append((b * 16 + st, reverse_bass(r, step * 3), 0.9))
        else:
            for st in (2, 6, 10, 14):
                ev.append((b * 16 + st, hc_bass(r, step * 1.8), 0.9))
    return normalize(render(bpm, len(PROGS[prog]), ev, choke=True))


def build_melodies(bpm=190):
    """Mélodies hardcore / gabber : thèmes, hooks, accords et thèmes complets (sans batterie), en fa mineur."""
    reseed('Melodies')
    MAGENTA, PINK, VIOLET, CYAN, BLUE, GREEN = 53, 57, 49, 37, 41, 21
    LOOP = 2
    M = lambda seed, prog, rh, kind, lo=64, hi=84, bars=None, legato=0.95: melody_loop(bpm, compose(seed, prog, rh, lo, hi, bars), kind, bars or 4, legato)
    themes = [
        # rangée 1 : thèmes gabber (leads)
        ('Hoover anthem', MAGENTA, M(101, 'epic', 'anthem', 'hoover')),
        ('Hoover dark', MAGENTA, M(102, 'dark', 'gabber', 'hoover')),
        ('Screech theme', MAGENTA, M(103, 'andalusian', 'hook', 'screech', 70, 86)),
        ('Screech gallop', MAGENTA, M(104, 'epic', 'gallop', 'screech', 70, 86, legato=0.8)),
        ('Horn theme', MAGENTA, M(105, 'euphoric', 'long', 'horn')),
        ('Dark lead run', MAGENTA, M(106, 'dark', 'sixteenths', 'darklead', 60, 79, legato=0.85)),
        ('Mentasm theme', PINK, M(107, 'andalusian', 'anthem', 'mentasm')),
        ('Acid line', MAGENTA, M(108, 'epic', 'sixteenths', 'acid', 60, 76, legato=0.7)),
        # rangée 2 : thèmes émotionnels (claviers, cordes, chœur)
        ('Piano theme', PINK, M(109, 'epic', 'anthem', 'piano')),
        ('Piano chords', PINK, chords_loop(bpm, 'epic', 'piano')),
        ('String theme', VIOLET, M(110, 'andalusian', 'long', 'strings', 60, 80)),
        ('Staccato run', VIOLET, M(111, 'epic', 'eighths', 'staccato')),
        ('Bells theme', PINK, M(112, 'dark', 'hook', 'bells', 67, 86)),
        ('Choir theme', CYAN, M(113, 'euphoric', 'long', 'choir', 60, 79)),
        ('Pluck arp', PINK, melody_loop(bpm, arpeggio('euphoric'), 'pluck', 4, 0.9, choke=False)),
        ('Supersaw theme', MAGENTA, M(114, 'epic', 'dotted', 'supersaw')),
        # rangée 3 : hooks de 2 mesures
        ('Hoover hook', MAGENTA, M(115, 'epic', 'hook', 'hoover', bars=2)),
        ('Screech hook', MAGENTA, M(116, 'dark', 'gabber', 'screech', 70, 86, bars=2)),
        ('Stab hook', PINK, M(117, 'epic', 'gabber', 'stab', bars=2)),
        ('Piano hook', PINK, M(118, 'andalusian', 'hook', 'piano', bars=2)),
        ('Pluck hook', PINK, M(119, 'euphoric', 'sixteenths', 'pluck', bars=2, legato=0.9)),
        ('Dark lead hook', MAGENTA, M(120, 'dark', 'dotted', 'darklead', 60, 79, bars=2)),
        ('Horn hook', MAGENTA, M(121, 'epic', 'offbeat', 'horn', bars=2)),
        ('Bells hook', PINK, M(122, 'andalusian', 'eighths', 'bells', 67, 86, bars=2)),
        # rangée 4 : accords, arpèges et basses à superposer
        ('Epic pads', VIOLET, chords_loop(bpm, 'epic', 'pad')),
        ('String pads dark', VIOLET, chords_loop(bpm, 'dark', 'strings')),
        ('Stab chords', PINK, chords_loop(bpm, 'epic', 'stab', (0, 3, 6, 8, 11, 14))),
        ('Choir pads', CYAN, chords_loop(bpm, 'andalusian', 'choir')),
        ('Arp epic', PINK, melody_loop(bpm, arpeggio('epic', (0, 1, 2, 3, 2, 1)), 'pluck', 4, 0.9, choke=False)),
        ('Arp dark', PINK, melody_loop(bpm, arpeggio('dark', (0, 2, 1, 3)), 'staccato', 4, 0.9, choke=False)),
        ('Offbeat bass line', BLUE, bass_line(bpm, 'epic')),
        ('Reese line', BLUE, bass_line(bpm, 'dark', 'reese')),
    ]
    # rangée 5 : thèmes complets (mélodie + accords + basse), prêts à poser sur un beat
    full = [
        ('Theme epic', ('epic', 201, 'anthem', 'hoover', 'pad', 'offbeat')),
        ('Theme dark', ('dark', 202, 'gabber', 'screech', 'strings', 'reese')),
        ('Theme andalusian', ('andalusian', 203, 'hook', 'darklead', 'choir', 'offbeat')),
        ('Theme euphoric', ('euphoric', 204, 'dotted', 'supersaw', 'pad', 'offbeat')),
        ('Theme piano', ('epic', 205, 'anthem', 'piano', 'strings', 'offbeat')),
        ('Theme horn', ('euphoric', 206, 'long', 'horn', 'pad', 'reese')),
        ('Theme bells', ('dark', 207, 'hook', 'bells', 'choir', 'offbeat')),
        ('Theme acid', ('andalusian', 208, 'sixteenths', 'acid', 'strings', 'offbeat')),
    ]
    for name, (prog, seed, rh, kind, pad, bass) in full:
        lo, hi = (70, 86) if kind == 'screech' else (60, 78) if kind == 'acid' else (64, 84)
        mel = melody_loop(bpm, compose(seed, prog, rh, lo, hi), kind, 4, 0.8 if kind == 'acid' else 0.95)
        themes.append((name, GREEN, mix(mel, chords_loop(bpm, prog, pad) * 0.55, bass_line(bpm, prog, bass) * 0.7)))
    return [(name, color, LOOP, sig, 4 if len(sig) > 3 * 240 / bpm * SR else 2) for name, color, sig in themes]


def build_hardstyle_melodies(bpm=150):
    """Mélodies hardstyle / rawstyle (150 BPM) : leads euphoriques, screeches raw, plucks, accords, thèmes complets."""
    reseed('Hardstyle melodies')
    MAGENTA, PINK, VIOLET, CYAN, BLUE, GREEN = 53, 57, 49, 37, 41, 21
    LOOP = 2
    M = lambda seed, prog, rh, kind, lo=64, hi=84, bars=None, legato=0.95: melody_loop(bpm, compose(seed, prog, rh, lo, hi, bars), kind, bars or 4, legato)
    themes = [
        # rangée 1 : leads euphoriques
        ('Euphoric theme 1', MAGENTA, M(301, 'euphoric', 'anthem', 'supersaw')),
        ('Euphoric theme 2', MAGENTA, M(302, 'epic', 'dotted', 'supersaw')),
        ('Euphoric theme 3', MAGENTA, M(303, 'andalusian', 'long', 'supersaw')),
        ('Euphoric theme 4', MAGENTA, M(304, 'euphoric', 'hook', 'supersaw')),
        ('Euphoric gallop', MAGENTA, M(305, 'epic', 'gallop', 'supersaw', legato=0.85)),
        ('Euphoric offbeat', MAGENTA, M(306, 'euphoric', 'offbeat', 'supersaw')),
        ('Euphoric hook', MAGENTA, M(307, 'epic', 'gabber', 'supersaw', bars=2)),
        ('Euphoric run', MAGENTA, M(308, 'andalusian', 'sixteenths', 'supersaw', legato=0.85)),
        # rangée 2 : screeches raw et leads sombres
        ('Raw screech theme', MAGENTA, M(309, 'dark', 'hook', 'rawscreech', 70, 86)),
        ('Raw screech gallop', MAGENTA, M(310, 'epic', 'gallop', 'rawscreech', 70, 86, legato=0.8)),
        ('Raw screech hook', MAGENTA, M(311, 'dark', 'gabber', 'rawscreech', 70, 86, bars=2)),
        ('Raw screech long', MAGENTA, M(312, 'andalusian', 'long', 'rawscreech', 70, 86)),
        ('Raw lead run', MAGENTA, M(313, 'dark', 'sixteenths', 'darklead', 60, 79, legato=0.85)),
        ('Raw lead hook', MAGENTA, M(314, 'epic', 'dotted', 'darklead', 60, 79, bars=2)),
        ('Raw hoover theme', MAGENTA, M(315, 'dark', 'anthem', 'hoover')),
        ('Raw stab hook', PINK, M(316, 'dark', 'gabber', 'stab', bars=2)),
        # rangée 3 : plucks, piano, cloches, chœur
        ('Pluck theme', PINK, M(317, 'euphoric', 'hook', 'pluck', legato=0.9)),
        ('Pluck run', PINK, M(318, 'epic', 'sixteenths', 'pluck', legato=0.9)),
        ('Pluck arp', PINK, melody_loop(bpm, arpeggio('euphoric', (0, 1, 2, 3, 2, 1, 0, 2)), 'pluck', 4, 0.9, choke=False)),
        ('Piano intro', PINK, M(319, 'euphoric', 'long', 'piano')),
        ('Piano theme', PINK, M(320, 'epic', 'anthem', 'piano')),
        ('Bells intro', PINK, M(321, 'andalusian', 'hook', 'bells', 67, 86)),
        ('Choir theme', CYAN, M(322, 'euphoric', 'long', 'choir', 60, 79)),
        ('String theme', VIOLET, M(323, 'epic', 'long', 'strings', 60, 80)),
        # rangée 4 : accords, arpèges, basses
        ('Euphoric chords', VIOLET, chords_loop(bpm, 'euphoric', 'pad')),
        ('Epic chords', VIOLET, chords_loop(bpm, 'epic', 'pad')),
        ('Stab chords', PINK, chords_loop(bpm, 'euphoric', 'stab', (0, 3, 6, 10, 12))),
        ('Piano chords', PINK, chords_loop(bpm, 'euphoric', 'piano')),
        ('Choir pads', CYAN, chords_loop(bpm, 'euphoric', 'choir')),
        ('String pads', VIOLET, chords_loop(bpm, 'andalusian', 'strings')),
        ('Reverse bass line', BLUE, bass_line(bpm, 'euphoric', 'reverse')),
        ('Reverse bass epic', BLUE, bass_line(bpm, 'epic', 'reverse')),
    ]
    full = [
        ('Anthem 1', ('euphoric', 401, 'anthem', 'supersaw', 'pad', 'reverse')),
        ('Anthem 2', ('epic', 402, 'dotted', 'supersaw', 'pad', 'reverse')),
        ('Anthem 3', ('andalusian', 403, 'hook', 'supersaw', 'choir', 'reverse')),
        ('Raw anthem', ('dark', 404, 'gallop', 'rawscreech', 'strings', 'reverse')),
        ('Raw anthem 2', ('epic', 405, 'gabber', 'rawscreech', 'pad', 'reverse')),
        ('Pluck anthem', ('euphoric', 406, 'sixteenths', 'pluck', 'pad', 'reverse')),
        ('Piano anthem', ('epic', 407, 'anthem', 'piano', 'strings', 'reverse')),
        ('Hoover anthem', ('dark', 408, 'anthem', 'hoover', 'pad', 'reverse')),
    ]
    for name, (prog, seed, rh, kind, pad, bass) in full:
        lo, hi = (70, 86) if kind == 'rawscreech' else (64, 84)
        mel = melody_loop(bpm, compose(seed, prog, rh, lo, hi), kind, 4, 0.85 if kind in ('pluck', 'rawscreech') else 0.95)
        themes.append((name, GREEN, mix(mel, chords_loop(bpm, prog, pad) * 0.5, bass_line(bpm, prog, bass) * 0.75)))
    return [(name, color, LOOP, sig, 4 if len(sig) > 3 * 240 / bpm * SR else 2) for name, color, sig in themes]


# ---------------------------------------------------------------- anthems (style grandes scènes hardcore) et guitares

def guitar_string(note, dur, damp=0.9965, bright=0.7, mute=False, seed=None):
    """Corde pincée (Karplus-Strong, calculée par blocs d'une période) : `mute` = étouffée à la paume."""
    r = np.random.default_rng(seed) if seed is not None else rng
    f = hz(note)
    N = max(2, int(round(SR / f)))
    n = int(dur * SR) + N + 2
    exc = r.uniform(-1, 1, N)
    # Attaque plus ou moins brillante : lissage de l'excitation.
    for _ in range(int((1 - bright) * 6) + (3 if mute else 0)):
        exc = 0.5 * (exc + np.roll(exc, 1))
    y = np.zeros(n)
    y[:N] = exc
    d = 0.93 if mute else damp
    for s in range(N, n, N):
        prev = y[s - N:s]
        prev1 = y[s - N - 1:s - 1] if s - N - 1 >= 0 else np.concatenate([[0.0], y[:N - 1]])
        y[s:s + N] = (d * 0.5 * (prev + prev1))[:len(y[s:s + N])]
    y = y[:int(dur * SR)]
    return fade(y, fin=0.0005, fout=0.008)


def power_chord(root, dur, mute=False, seed=None, strum=0.006, octave=True):
    """Quinte (racine, quinte, octave) grattée de haut en bas."""
    notes = [root, root + 7] + ([root + 12] if octave else [])
    n = int((dur + strum * 3) * SR)
    x = np.zeros(n)
    for k, nt in enumerate(notes):
        s = guitar_string(nt, dur, mute=mute, seed=None if seed is None else seed + k)
        o = int(k * strum * SR)
        x[o:o + len(s)] += s[:n - o]
    return x[:int(dur * SR)]


def amp(x, gain=18.0, tight=True):
    """Ampli saturé + baffle 4x12 : resserrage des basses, distorsion asymétrique, corps dans le bas-médium,
    creux du « fizz » vers 3 kHz et coupure du haut-parleur (pas d'aigus agressifs)."""
    if tight:
        x = biquad(x, 'hp', 110, 0.7)
    x = biquad(x, 'peak', 900, 0.8, 4)
    y = np.tanh(gain * x + 0.15) - np.tanh(0.15)
    y = np.tanh(1.6 * y)
    y = biquad(y, 'peak', 120, 0.9, 4)      # résonance du baffle
    y = biquad(y, 'peak', 250, 0.8, 2)      # corps
    y = biquad(y, 'peak', 3200, 1.0, -7)    # creux du « fizz »
    y = biquad(biquad(y, 'lp', 4200, 0.8), 'lp', 5600, 0.7)
    return biquad(y, 'hp', 70, 0.7)


def guitar_take(bpm, bars, hits, seed):
    """Une prise de guitare : hits = (pas, racine, durée en pas, étouffé, accord?). Rendue puis passée dans l'ampli."""
    step = step_len(bpm)
    r = np.random.default_rng(seed)
    ev = []
    for k, (st, root, du, mute, chord) in enumerate(hits):
        human = r.uniform(-0.004, 0.004) / step   # léger décalage humain
        d = du * step * (0.92 if mute else 0.98)
        sig = power_chord(root, d, mute, seed=seed * 1000 + k) if chord else guitar_string(root, d, mute=mute, seed=seed * 1000 + k)
        ev.append((max(0, st + human), sig * (0.85 if mute else 1.0)))
    return amp(normalize(render(bpm, bars, ev, choke=True)))


def guitar_loop(bpm, bars, hits):
    """Guitare doublée (deux prises gauche / droite), comme en studio : stéréo."""
    L = guitar_take(bpm, bars, hits, 11)
    R = guitar_take(bpm, bars, hits, 23)
    return normalize(np.stack([L, R], axis=1))


def to_stereo(x):
    return x if x.ndim == 2 else np.stack([x, x], axis=1)


def mix_st(*parts):
    """Mélange de boucles mono ou stéréo (gain compris), saturation douce et normalisation."""
    n = max(len(p) for p, _ in parts)
    out = np.zeros((n, 2))
    for p, g in parts:
        s = to_stereo(p)
        out[:len(s)] += g * s
    return normalize(np.tanh(1.2 * normalize(out, 1.0)), 0.89)


def anthem_lead(note, dur):
    """Lead d'anthem : supersaw à l'octave + hoover + scie saturée, le gros son des hymnes de festival."""
    a = supersaw([note, note + 12], dur, attack=0.004, release=0.18, cutoff=7500, verb=0.22)
    b = hoover(note, dur, bend=False)
    n = max(len(a), len(b))
    x = np.zeros(n)
    x[:len(a)] += a
    x[:len(b)] += 0.55 * b
    return fade(normalize(np.tanh(1.6 * x)), fout=0.05)


def build_anthems(bpm=190):
    """Anthems : leads d'hymnes, guitares saturées, couches à superposer, rythmiques, anthems complets.
    Tout en fa mineur sur la même suite d'accords (Fm - Db - Eb - Cm) : les boucles se superposent entre elles."""
    reseed('Anthems')
    MAGENTA, PINK, VIOLET, CYAN, BLUE, GREEN, RED, ORANGE, YELLOW, COPPER = 53, 57, 49, 37, 41, 21, 5, 9, 13, 108
    LOOP = 2
    prog = 'epic'
    roots = [ROOT_NOTE[c] for c in PROGS[prog]]   # fa, réb, mib, do : basses et guitare accordée bas
    step = step_len(bpm)
    inst_cache = {}

    def lead(seed, rh, kind='anthem', lo=64, hi=84, p=prog, legato=0.95):
        notes = compose(seed, p, rh, lo, hi)
        if kind != 'anthem':
            return melody_loop(bpm, notes, kind, 4, legato)
        ev = []
        for st, n, du in notes:
            key = (n, du)
            if key not in inst_cache:
                inst_cache[key] = anthem_lead(n, du * step * legato)
            ev.append((st, inst_cache[key], 0.9))
        return normalize(render(bpm, 4, ev, choke=True))

    # ---- batterie d'anthem : kick à queue, clap, charleys, crash ----
    kick = tail_kick(41, drive=16, tail=0.42, dur=0.6, bend=0.35, formant=1200, bite=7)
    k_short = fade(kick[:int(step * 4 * SR)], fout=0.01)
    cl = clap()
    hh = hat(0.05)
    oh = hat(0.16, 3)
    cr = crash909()
    rd = ride()
    def drums(kicks=None, claps=True, hats=True, crash=True, ride_on=False, bars=4):
        ev = [(s, k_short, 1.0) for s in (kicks if kicks is not None else four(bars))]
        k = normalize(render(bpm, bars, ev, choke=True)) if ev else np.zeros(int(round(bars * 240 / bpm * SR)))
        extra = []
        if claps:
            extra += [(b * 16 + s, cl, 0.55) for b in range(bars) for s in (4, 12)]
        if hats:
            extra += [(b * 16 + s, oh, 0.4) for b in range(bars) for s in (2, 6, 10, 14)]
            extra += [(b * 16 + s, hh, 0.25) for b in range(bars) for s in (1, 3, 5, 7, 9, 11, 13, 15)]
        if ride_on:
            extra += [(b * 16 + s, rd, 0.3) for b in range(bars) for s in range(0, 16, 2)]
        if crash:
            extra += [(0, cr, 0.5)]
        top = render(bpm, bars, extra) if extra else 0
        return normalize(k + 0.8 * top)

    # ---- rangée 1 : leads d'anthem ----
    leads = [
        ('Anthem lead', MAGENTA, lead(501, 'anthem')),
        ('Anthem hook', MAGENTA, lead(502, 'hook')),
        ('Anthem dotted', MAGENTA, lead(503, 'dotted')),
        ('Anthem long', MAGENTA, lead(504, 'long')),
        ('Anthem gallop', MAGENTA, lead(505, 'gallop', legato=0.85)),
        ('Anthem hoover', MAGENTA, lead(506, 'anthem', 'hoover')),
        ('Anthem screech', MAGENTA, lead(507, 'hook', 'screech', 70, 86)),
        ('Anthem horn', MAGENTA, lead(508, 'long', 'horn')),
    ]

    # ---- rangée 2 : guitares saturées (doublées en stéréo) ----
    G = lambda hits: guitar_loop(bpm, 4, hits)
    chug = [(b * 16 + s, roots[b], 1, True, False) for b in range(4) for s in range(16) if s not in (0, 8)] + \
           [(b * 16 + s, roots[b], 2, False, True) for b in range(4) for s in (0, 8)]
    power = [(b * 16, roots[b], 10, False, True) for b in range(4)] + [(b * 16 + 10, roots[b], 6, False, True) for b in range(4)]
    gallop = [(b * 16 + s, roots[b], 1, True, False) for b in range(4) for s in GALLOP if s != 0] + [(b * 16, roots[b], 1, False, True) for b in range(4)]
    stabs = [(b * 16 + s, roots[b], 1.5, False, True) for b in range(4) for s in (2, 6, 10, 14)]
    # Riff : la racine étouffée et des notes de la gamme en accents (fa mineur, une octave au-dessus).
    riff_bar = [(0, 0, 2, False, True), (2, 0, 1, True, False), (3, 0, 1, True, False), (4, 3, 2, False, False), (6, 0, 1, True, False),
                (7, 0, 1, True, False), (8, 5, 2, False, False), (10, 0, 1, True, False), (11, 6, 2, False, False), (13, 0, 1, True, False), (14, 3, 2, False, False)]
    # Les notes du riff sont des degrés de la gamme au-dessus de la racine de l'accord (pas de fausse note).
    deg = {0: 0, 3: 2, 5: 3, 6: 4}
    riff = [(b * 16 + s, scale_step(roots[b], deg[d], scale_pcs(PROGS[prog][b])), du, m, c) for b in range(4) for s, d, du, m, c in riff_bar]
    breakdown = [(b * 16 + s, roots[b], du, m, True) for b in range(4) for s, du, m in ((0, 3, False), (3, 1, True), (6, 2, False), (8, 1, True), (11, 3, False))]
    glead_notes = compose(509, prog, 'anthem', 64, 79)
    glead = guitar_loop(bpm, 4, [(st, n, du, False, False) for st, n, du in glead_notes])
    guitars = [
        ('Guitar chug', COPPER, G(chug)),
        ('Guitar power chords', COPPER, G(power)),
        ('Guitar gallop', COPPER, G(gallop)),
        ('Guitar riff', COPPER, G(riff)),
        ('Guitar stabs', COPPER, G(stabs)),
        ('Guitar breakdown', COPPER, G(breakdown)),
        ('Guitar lead', COPPER, glead),
    ]
    guitars.append(('Guitar + kick', COPPER, mix_st((guitars[0][2], 0.8), (drums(claps=False, hats=False, crash=False), 0.9))))

    # ---- rangée 3 : couches à superposer (même suite d'accords) ----
    sub = []
    for b, r in enumerate(roots):
        t = t_of(step * 16)
        sub.append((b * 16, fade(np.sin(2 * np.pi * hz(r) * t) * np.clip(t / 0.02, 0, 1), fout=0.03), 0.9))
    layers = [
        ('Layer pad', VIOLET, chords_loop(bpm, prog, 'pad')),
        ('Layer strings', VIOLET, chords_loop(bpm, prog, 'strings')),
        ('Layer choir', CYAN, chords_loop(bpm, prog, 'choir')),
        ('Layer stabs', PINK, chords_loop(bpm, prog, 'stab', (0, 3, 6, 10, 12))),
        ('Layer arp', PINK, melody_loop(bpm, arpeggio(prog, (0, 1, 2, 3, 2, 1, 0, 2)), 'pluck', 4, 0.9, choke=False)),
        ('Layer bells', PINK, melody_loop(bpm, compose(510, prog, 'long', 72, 88), 'bells', 4)),
        ('Layer offbeat bass', BLUE, bass_line(bpm, prog)),
        ('Layer sub bass', BLUE, normalize(render(bpm, 4, sub, choke=True))),
    ]

    # ---- rangée 4 : rythmiques d'anthem ----
    build = list(range(0, 16, 4)) + list(range(16, 32, 2)) + list(range(32, 48)) + [48 + i / 2 for i in range(32)]
    loop_n = int(round(4 * 240 / bpm * SR))
    rs = np.zeros(loop_n)
    rz = riser(4 * 240 / bpm)[:loop_n]
    rs[:len(rz)] = rz
    roll_build = normalize(normalize(render(bpm, 4, [(s, k_short, 1.0) for s in build], choke=True)) + 0.5 * rs)
    stomp = [(b * 16 + s, tom(41, drive=3, dur=0.35), 0.9) for b in range(4) for s in (0, 8)] + [(b * 16 + s, cl, 0.8) for b in range(4) for s in (4, 12)]
    toms = [(b * 16 + s, tom(n, drive=4, dur=0.3), 0.8) for b in range(4) for s, n in ((0, 45), (3, 45), (6, 41), (8, 48), (11, 45), (14, 41))]
    beats = [
        ('Anthem beat', RED, drums()),
        ('Anthem beat ride', RED, drums(ride_on=True)),
        ('Anthem gallop beat', RED, drums(kicks=[b * 16 + s for b in range(4) for s in GALLOP], hats=False)),
        ('Kick roll build', RED, roll_build),
        ('Half-time beat', RED, drums(kicks=[b * 16 + s for b in range(4) for s in (0, 10)], hats=True, crash=True)),
        ('Off-kick beat', RED, drums(kicks=[b * 16 + s for b in range(4) for s in (0, 4, 8, 12, 14)])),
        ('Clap stomp', ORANGE, normalize(reverb(render(bpm, 4, stomp), 1.0, 0.25)[:loop_n])),
        ('Tribal toms', ORANGE, normalize(render(bpm, 4, toms))),
    ]

    # ---- rangée 5 : anthems complets (lead + guitare / accords + basse + batterie) ----
    full = [
        ('Festival anthem', mix_st((leads[0][2], 0.75), (layers[0][2], 0.4), (layers[6][2], 0.55), (beats[0][2], 0.85))),
        ('Guitar anthem', mix_st((leads[1][2], 0.7), (guitars[1][2], 0.55), (layers[6][2], 0.45), (beats[0][2], 0.85))),
        ('Anthem riff drop', mix_st((guitars[3][2], 0.7), (leads[5][2], 0.55), (beats[1][2], 0.85))),
        ('Anthem screech drop', mix_st((leads[6][2], 0.65), (layers[1][2], 0.4), (layers[6][2], 0.5), (beats[0][2], 0.85))),
        ('Anthem break', mix_st((leads[3][2], 0.6), (layers[2][2], 0.6), (layers[1][2], 0.5), (layers[5][2], 0.35))),
        ('Anthem build', mix_st((layers[4][2], 0.5), (layers[0][2], 0.45), (beats[3][2], 0.9))),
        ('Guitar breakdown drop', mix_st((guitars[5][2], 0.75), (layers[2][2], 0.4), (beats[4][2], 0.85))),
        ('Anthem finale', mix_st((leads[2][2], 0.65), (guitars[0][2], 0.45), (layers[0][2], 0.35), (layers[6][2], 0.45), (beats[1][2], 0.85))),
    ]
    sounds = leads + guitars + layers + beats + [(n, GREEN, s) for n, s in full]
    return [(name, color, LOOP, sig, 4) for name, color, sig in sounds]
