import * as hre from "hardhat";
import { getWallet, getProvider } from "./utils";
import { ethers } from "ethers";
import { Wallet } from "zksync-ethers";
import { getPaymasterParams } from "zksync-ethers/build/paymaster-utils";
import { DEFAULT_GAS_PER_PUBDATA_LIMIT } from "zksync-ethers/build/utils";

// Address of the contracts to interact with
const CONTRACT_ADDRESS = "";
const PAYMASTER_CONTRACT_ADDRESS = "";
if (!CONTRACT_ADDRESS || !PAYMASTER_CONTRACT_ADDRESS)
  throw "⛔️ Provide address of the contract to interact with!";

// An example of a script to interact with the contract
export default async function () {
  console.log(`Running script to interact with contract ${CONTRACT_ADDRESS}`);

  // Load compiled contract info
  const contractArtifact = await hre.artifacts.readArtifact("Greeter");

  await fundPaymaster(PAYMASTER_CONTRACT_ADDRESS);

  const provider = getProvider();
  const newWallet = Wallet.createRandom();
  const wallet = new Wallet(newWallet.privateKey, provider);
  let balance = await wallet.getBalance();
  console.log("Wallet balance:", balance, "ETH");

  let paymasterBalance = await provider.getBalance(PAYMASTER_CONTRACT_ADDRESS);
  console.log("Paymaster balance:", paymasterBalance, "ETH");

  // Initialize contract instance for interaction
  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    contractArtifact.abi,
    wallet // Interact with the contract on behalf of this wallet
  );

  // Run contract read function
  const response = await contract.greet();
  console.log(`Current message is: ${response}`);

  const newGreeting = "Hello Aleph!";

  const overrides = await getPaymasterOverrides(
    PAYMASTER_CONTRACT_ADDRESS,
    contract,
    newGreeting
  );

  // Run contract write function
  const transaction = await contract.setGreeting(newGreeting, overrides);
  console.log(`Transaction hash of setting new message: ${transaction.hash}`);

  // Wait until transaction is processed
  await transaction.wait();

  // Read message after transaction
  console.log(`The message now is: ${await contract.greet()}`);

  balance = await wallet.getBalance();
  console.log("Final Wallet balance:", balance, "ETH");

  paymasterBalance = await provider.getBalance(PAYMASTER_CONTRACT_ADDRESS);
  console.log("Final Paymaster balance:", paymasterBalance, "ETH");
}

async function fundPaymaster(toAddress: string) {
  const wallet = getWallet();
  const tx = await wallet.sendTransaction({
    to: toAddress,
    value: ethers.parseEther("0.5"),
  });

  await tx.wait();
}

async function getPaymasterOverrides(
  paymasterAddress: string,
  contract: ethers.Contract,
  newGreeting: string 
) {
  const paymasterParams = getPaymasterParams(paymasterAddress, {
    type: "General",
    innerInput: new Uint8Array(),
  });

  const provider = getProvider();
  const gasPrice = await provider.getGasPrice();
  const gasLimit = await contract.setGreeting.estimateGas(newGreeting, {
    customData: {
      gasPerPubdata: DEFAULT_GAS_PER_PUBDATA_LIMIT,
      paymasterParams: paymasterParams,
    },
  });

  return {
    maxFeePerGas: gasPrice,
    maxPriorityFeePerGas: BigInt(1),
    gasLimit,
    customData: {
      gasPerPubdata: DEFAULT_GAS_PER_PUBDATA_LIMIT,
      paymasterParams,
    },
  };
}
