import { ethers } from 'hardhat'
import { AddressZero } from './constants'
import * as typ from './solidityTypes'
import { ecsign, toRpcSig, keccak256 as keccak256_buffer, bufferToHex } from 'ethereumjs-util'
import { AbiCoder, keccak256, BytesLike, hexlify, zeroPadValue, BigNumberish, toBeHex } from 'ethers'
export const defaultAbiCoder = new AbiCoder()
export const hexZeroPad = zeroPadValue;
export const hexConcat = ethers.concat;
export interface UserOperation {

  sender: typ.address
  nonce: typ.uint256
  initCode: BytesLike
  callData: BytesLike
  callGasLimit: BytesLike
  verificationGasLimit: BytesLike
  preVerificationGas: typ.uint256
  maxFeePerGas: BytesLike
  maxPriorityFeePerGas: BytesLike
  paymaster: typ.address
  paymasterVerificationGasLimit: BytesLike
  paymasterPostOpGasLimit: BytesLike
  paymasterData: typ.bytes
  signature: typ.bytes
}

export interface PackedUserOperation {

  sender: typ.address
  nonce: typ.uint256
  initCode: BytesLike
  callData: BytesLike
  accountGasLimits: typ.bytes32
  preVerificationGas: typ.uint256
  gasFees: typ.bytes32
  paymasterAndData: BytesLike
  signature: typ.bytes
}

// Ensure ethers is imported for AddressZero
export const bufferToHexa = (hex : string) => bufferToHex(Buffer.from(hex, 'hex'))
export const DefaultsForUserOp: UserOperation = {
  sender: AddressZero,
  nonce: 0,
  initCode: '0x',
  callData: '0x',
  callGasLimit: bufferToHexa('0x0'), // 0 in hex
  verificationGasLimit: bufferToHexa('0x493E0'), // 300000 in hex
  preVerificationGas: 21000, // Should also cover calldata cost
  maxFeePerGas: bufferToHexa('0x0'), // Max fee per gas in hex
  maxPriorityFeePerGas:   bufferToHexa('0x3B9ACA00'), // 1 Gwei in hex
  paymaster: AddressZero,
  paymasterData: '0x',
  paymasterVerificationGasLimit: bufferToHexa('0x493E0'), // 300000 in hex
  paymasterPostOpGasLimit: bufferToHexa('0x0'), // 300000 in hex
  signature: '0x'
};

export function packAccountGasLimits (verificationGasLimit: BytesLike, callGasLimit: BytesLike): string {
  return hexConcat([
    hexZeroPad(hexlify(verificationGasLimit), 16), hexZeroPad(hexlify(callGasLimit), 16)
  ])
}

export function packPaymasterData (paymaster: string, paymasterVerificationGasLimit: BytesLike , postOpGasLimit: BytesLike , paymasterData: string): string {
  return hexConcat([
    paymaster, hexZeroPad(hexlify(paymasterVerificationGasLimit), 16),
    hexZeroPad(hexlify(postOpGasLimit), 16), paymasterData
  ])
}
export function packUserOp (userOp: UserOperation): PackedUserOperation {
  const accountGasLimits = packAccountGasLimits(userOp.verificationGasLimit, userOp.callGasLimit)
  const gasFees = packAccountGasLimits(userOp.maxPriorityFeePerGas, userOp.maxFeePerGas)
  let paymasterAndData = '0x'
  if (userOp.paymaster?.length >= 20 && userOp.paymaster !== AddressZero) {
    paymasterAndData = packPaymasterData(userOp.paymaster as string, userOp.paymasterVerificationGasLimit, userOp.paymasterPostOpGasLimit, userOp.paymasterData as string)
  }
  return {
    sender: userOp.sender,
    nonce: userOp.nonce,
    callData: userOp.callData,
    accountGasLimits,
    initCode: userOp.initCode,
    preVerificationGas: userOp.preVerificationGas,
    gasFees,
    paymasterAndData,
    signature: userOp.signature
  }
}
export interface ValidationData {
  aggregator: string
  validAfter: BytesLike
  validUntil: BytesLike
}
export function parseValidationData (data: ValidationData): string {

  const validationData = hexZeroPad(hexlify(data.aggregator), 32) + hexZeroPad(hexlify(data.validAfter), 32) + hexZeroPad(hexlify(data.validUntil), 32)
  return validationData
}
export function dateToHex (date: Date): string {
  const dateHex = bufferToHexa(date.getTime().toString(16))
  return hexlify(dateHex)
}

export function encodeUserOp (userOp: UserOperation, forSignature = true): string {
  const packedUserOp = packUserOp(userOp)
  if (forSignature) {
    return defaultAbiCoder.encode(
      ['address', 'uint256', 'bytes32', 'bytes32',
        'bytes32', 'uint256', 'bytes32',
        'bytes32'],
      [packedUserOp.sender, packedUserOp.nonce, keccak256(packedUserOp.initCode), keccak256(packedUserOp.callData),
        packedUserOp.accountGasLimits, packedUserOp.preVerificationGas, packedUserOp.gasFees,
        keccak256(packedUserOp.paymasterAndData)])
  } else {
    // for the purpose of calculating gas cost encode also signature (and no keccak of bytes)
    return defaultAbiCoder.encode(
      ['address', 'uint256', 'bytes', 'bytes',
        'bytes32', 'uint256', 'bytes32',
        'bytes', 'bytes'],
      [packedUserOp.sender, packedUserOp.nonce, packedUserOp.initCode, packedUserOp.callData,
        packedUserOp.accountGasLimits, packedUserOp.preVerificationGas, packedUserOp.gasFees,
        packedUserOp.paymasterAndData, packedUserOp.signature])
  }
}
export function getUserOpHash (op: UserOperation, entryPoint: string, chainId: number): string {
  const userOpHash = keccak256(encodeUserOp(op, true))

  const enc = defaultAbiCoder.encode(
    ['bytes32', 'address', 'uint256'],
    [userOpHash, entryPoint, chainId])
  return keccak256(enc)
}