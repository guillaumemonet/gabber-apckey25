// Annuler / rétablir : instantanés (texte JSON) d'un état. `commit()` enregistre l'état s'il a changé
// depuis le dernier instantané ; `undo()` / `redo()` reviennent en arrière / en avant.

export class History {
  // read() -> instantané (chaîne) ; write(instantané) remet l'état en place.
  constructor(read, write, limit = 100) {
    this.read = read;
    this.write = write;
    this.limit = limit;
    this.past = [];
    this.future = [];
    this.last = read();
    this.onChange = () => {};
  }

  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }

  commit() {
    const cur = this.read();
    if (cur === this.last) return;
    this.past.push(this.last);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    this.last = cur;
    this.onChange();
  }

  undo() { return this.step(this.past, this.future); }
  redo() { return this.step(this.future, this.past); }

  step(from, to) {
    this.commit();
    if (!from.length) return false;
    to.push(this.last);
    this.last = from.pop();
    this.write(this.last);
    this.onChange();
    return true;
  }
}
