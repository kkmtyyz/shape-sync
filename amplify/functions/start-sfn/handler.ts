import type { Schema } from "../../data/resource"

export const handler: Schema["startSfn"]["functionHandler"] = async (event) => {
  // arguments typed from `.arguments()`
  const { name } = event.arguments
  console.log(name);
  // return typed from `.returns()`
  return `Hello, ${name}!`
}
