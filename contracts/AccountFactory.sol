// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;



import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import "./Account.sol";

contract AccountFactory {

    event AccountCreated(address indexed account, address indexed owner);

    Acccount public immutable accountImplementation;

    constructor(IEntryPoint _entryPoint) {
        accountImplementation = new Account(_entryPoint);
    }

    function createAccount(address owner,uint256 salt) public returns (Account ret) {
        address addr = getAddress(owner, salt);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return Account(payable(addr));
        }
        ret = Account(payable(new ERC1967Proxy{salt : bytes32(salt)}(
                address(accountImplementation),
                abi.encodeCall(Account.initialize, (owner))
            )));
    }

    function getAddress(address owner,uint256 salt) public view returns (address) {
        return Create2.computeAddress(bytes32(salt), keccak256(abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(
                    address(accountImplementation),
                    abi.encodeCall(Account.initialize, (owner))
                )
            )));
    }
}