import deployEntryPoint from "./deployEntryPoint";
import hre from "hardhat";
async function Main() {
  await  deployEntryPoint(hre)
}
Main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
    });