import { ethers } from 'hardhat'
import { AddressZero } from './constants'
import * as typ from './solidityTypes'
import { ecsign, toRpcSig, keccak256 as keccak256_buffer, bufferToHex, zeroAddress } from 'ethereumjs-util'
import { AbiCoder, keccak256, BytesLike, hexlify, zeroPadValue, BigNumberish, toBeHex } from 'ethers'
import { zeroPad } from '@ethersproject/bytes'
import { PackedUserOperationStruct } from '../typechain-types/contracts/Account'
export const defaultAbiCoder = new AbiCoder()
export const hexZeroPad = zeroPadValue;
export const hexConcat = ethers.concat;
export interface UserOperation {

  sender: typ.address
  nonce: typ.uint256
  initCode: BytesLike
  callData: BytesLike
  callGasLimit: typ.uint128
  verificationGasLimit: typ.uint128
  preVerificationGas: typ.uint256
  maxFeePerGas: typ.uint256
  maxPriorityFeePerGas: typ.uint256
  paymaster: typ.address
  paymasterVerificationGasLimit: typ.uint128
  paymasterPostOpGasLimit: typ.uint128
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
export const bufferToHexa = (hex: string) => bufferToHex(Buffer.from(hex, 'hex'))
export const DefaultsForUserOp: UserOperation = {
  sender: AddressZero,
  nonce: 0,
  initCode: '0x',
  callData: '0x',
  callGasLimit: 0,
  verificationGasLimit: 150000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
  preVerificationGas: 21000, // should also cover calldata cost.
  maxFeePerGas: 0,
  maxPriorityFeePerGas: 1e9,
  paymaster: AddressZero,
  paymasterData: '0x',
  paymasterVerificationGasLimit: 3e5,
  paymasterPostOpGasLimit: 0,
  signature: '0x'
}

export function packAccountGasLimits(verificationGasLimit: BigNumberish, callGasLimit: BigNumberish): string {
  const verificationGasLimitHex = toBeHex(verificationGasLimit)
  const callGasLimitHex = toBeHex(callGasLimit)
  return hexConcat([
    hexZeroPad(hexlify(verificationGasLimitHex), 16), hexZeroPad(hexlify(callGasLimitHex), 16)
  ])
}

export function packPaymasterData(paymaster: string, paymasterVerificationGasLimit: BigNumberish, postOpGasLimit: BigNumberish, paymasterData: string): string {

  const paymasterVerificationGasLimitHex = toBeHex(paymasterVerificationGasLimit)
  const postOpGasLimitHex = toBeHex(postOpGasLimit)

  return hexConcat([
    paymaster, hexZeroPad(hexlify(paymasterVerificationGasLimitHex), 16),
    hexZeroPad(hexlify(postOpGasLimitHex), 16), paymasterData
  ])
}
export function packUserOp(userOp: UserOperation): PackedUserOperationStruct {
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
    signature: userOp.signature as string
  }
}
export interface ValidationData {
  aggregator: string
  validAfter: BytesLike
  validUntil: BytesLike
}
export function parseValidationData(data: ValidationData): string {

  const validationData = hexZeroPad(hexlify(data.aggregator), 32) + hexZeroPad(hexlify(data.validAfter), 32) + hexZeroPad(hexlify(data.validUntil), 32)
  return validationData
}
export function dateToHex(date: Date): string {
  let dateHex = date.getTime().toString(16);
  // Ensure even length
  if (dateHex.length % 2 !== 0) {
    dateHex = '0' + dateHex;
  }
  return hexlify(zeroPad(`0x${dateHex}`, 6));
}

export function encodeUserOp(userOp: UserOperation, forSignature = true): string {
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

export function getUserOpHash(op: UserOperation, entryPoint: string, chainId: number): string {
  const userOpHash = keccak256(encodeUserOp(op, true))

  const enc = defaultAbiCoder.encode(
    ['bytes32', 'address', 'uint256'],
    [userOpHash, entryPoint, chainId])
  return keccak256(enc)
}