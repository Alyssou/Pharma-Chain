// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract PharmaChain is AccessControl {
    // Roles definition
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant PHARMACIST_ROLE = keccak256("PHARMACIST_ROLE");

    enum Status { Manufactured, InTransit, Delivered, Sold }

    struct Batch {
        bytes32 name;        
        address currentOwner;
        Status status;       
        uint40 timestamp;    
    }

    mapping(uint256 => Batch) public batches;

    event BatchUpdated(uint256 indexed batchId, address indexed actor, Status status, uint256 time);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function manufactureBatch(uint256 _id, bytes32 _name) external onlyRole(MANUFACTURER_ROLE) {
        require(batches[_id].timestamp == 0, "ID exists");

        batches[_id] = Batch({
            name: _name,
            currentOwner: msg.sender,
            status: Status.Manufactured,
            timestamp: uint40(block.timestamp)
        });

        emit BatchUpdated(_id, msg.sender, Status.Manufactured, block.timestamp);
    }

    /**
     * @dev Enhanced Transfer Logic with Role Security
     */
    function transferBatch(
        uint256 _id, 
        address _newOwner, 
        Status _newStatus
    ) external {
        Batch memory batch = batches[_id];
        
        // 1. Basic Security: Only the current possessor can move the batch
        require(batch.currentOwner == msg.sender, "Not the current owner");
        require(_newOwner != address(0), "Invalid address");
        require(_newStatus > batch.status, "Invalid status progression");

        // 2. Specific Role Requirements for each "Step"
        if (_newStatus == Status.InTransit) {
            // Step 1: Manufacturer sending to Distributor
            require(batch.status == Status.Manufactured, "Current status must be Manufactured");
            require(hasRole(MANUFACTURER_ROLE, msg.sender), "Sender must be Manufacturer");
            require(hasRole(DISTRIBUTOR_ROLE, _newOwner), "Recipient must be Distributor");
        } 
        else if (_newStatus == Status.Delivered) {
            // Step 2: Distributor sending to Pharmacist
            require(batch.status == Status.InTransit, "Current status must be InTransit");
            require(hasRole(DISTRIBUTOR_ROLE, msg.sender), "Sender must be Distributor");
            require(hasRole(PHARMACIST_ROLE, _newOwner), "Recipient must be Pharmacist");
        } 
        else if (_newStatus == Status.Sold) {
            // Step 3: Pharmacist selling to a Patient
            require(batch.status == Status.Delivered, "Current status must be Delivered");
            require(hasRole(PHARMACIST_ROLE, msg.sender), "Only Pharmacist can sell");
        } else {
            revert("Unsupported status");
        }

        // 3. Update the data (Gas optimized - writing to memory first)
        batch.currentOwner = _newOwner;
        batch.status = _newStatus;
        batch.timestamp = uint40(block.timestamp);

        // 4. One single write back to storage
        batches[_id] = batch;

        emit BatchUpdated(_id, msg.sender, _newStatus, block.timestamp);
    }
}