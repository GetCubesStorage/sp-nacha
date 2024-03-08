
interface BaseField {
  name: string,
  width: number,
  position: number,
  blank?: boolean,
  required?: boolean,
  paddingChar?: string,
}

export interface StringField extends BaseField {
  type: "alphanumeric" | "ABA" | "numeric",
  number?: false,
  value: string,
}

export interface NumberField extends BaseField {
  type: "numeric",
  number: true,
  value: number,
}

export type Field = StringField | NumberField;