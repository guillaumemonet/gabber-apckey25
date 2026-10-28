# Compositeur musical de GabberKey : Anticipatory Music Transformer (Stanford CRFM, Apache 2.0), un modèle entraîné
# sur des fichiers MIDI, qui écrit des notes (lead, basse, contre-chant) sur les accords d'un morceau.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir torch==2.5.1 --index-url https://download.pytorch.org/whl/cu124
RUN pip install --no-cache-dir "numpy<2" transformers==4.29.2 mido==1.2.10 tqdm==4.65.0 \
 && pip install --no-cache-dir --no-deps git+https://github.com/jthickstun/anticipation@af37397922665a0fb8d474d7988b0f3755a38d45

WORKDIR /app
COPY server.py .
ENV HF_HOME=/models PYTHONUNBUFFERED=1
EXPOSE 8090
CMD ["python", "server.py"]
