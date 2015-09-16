import entities from 'html-entities';
const ent = new entities.AllHtmlEntities();

export function escaper(schema) {
  const keys = [];

  schema.eachPath((path, type) => {
    if (type.options && type.options.escape) {
      keys.push(path);
    }
  });

  schema.pre('validate', function _escape(next) {
    keys.forEach(path => {
      this.set(path, ent.encode(ent.decode(this.get(path))));
    });
    next();
  });
}

export function validator(value) {
  return value === ent.encode(ent.decode(value));
}
