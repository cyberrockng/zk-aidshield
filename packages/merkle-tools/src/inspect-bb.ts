import { Barretenberg, Fr } from "@aztec/bb.js";
const bb = await Barretenberg.new(1);
const result = await bb.pedersenHash([new Fr(1n), new Fr(2n)], 0);
console.log("type:", typeof result);
console.log("constructor:", result?.constructor?.name);
console.log("value:", result);
console.log("toBuffer:", typeof (result as any).toBuffer);
console.log("toString:", typeof (result as any).toString);
console.log("toBigInt:", typeof (result as any).toBigInt);
console.log("limbs:", typeof (result as any).limbs);
if ((result as any).toBuffer) {
  const buf = (result as any).toBuffer();
  console.log("buffer:", buf.toString("hex"));
  console.log("as bigint:", BigInt("0x" + buf.toString("hex")));
}
await bb.destroy();
