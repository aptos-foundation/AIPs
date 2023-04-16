# Aptos Improvement Proposals (AIPs)

Aptos Improvement Proposals (AIP) describe standards for the Aptos Network including the core blockchain protocol and the development platform (Move), smart contracts and systems for smart contract verification, standards for the deployment and operation of the Aptos Network, APIs for accessing the Aptos Network and processing information from the Aptos Network.

## How to submit an AIP

 1. Fork this repo into your own GitHub
 2. Copy `TEMPLATE.md` into your new AIP file in `aips/<your-feature-name-NO-AIP-#-here>.md`
    + Name your AIP file based on your feature, not the AIP number, which will be picked for your later.
    + e.g., `new-zero-knowledge-range-proof-verifiers.md` is a good name.
    - ...but `aip-14.md` or `14.md` is **NOT** a good name.
 3. Edit your AIP file
    - Fill in the YAML header (see instructions there)
    - Follow the template guidelines to the best of your ability
 4. Commit these changes to your repo
 5. Submit a pull request on GitHub to this repo.

## AIP Overview

This table contains an overview of all created and tracked AIPs. It should be updated with each new AIP.

| AIP Number | AIP Title |
|--|--|
| AIP 0 | Aptos Improvement Proposals |
| AIP 1 | Proposer selection improvements |
| AIP 2 | Multiple Token Changes |
| AIP 3 | Multi-step Governance Proposal |
| AIP 4 | Update Simple Map To Save Gas |
| AIP 5 | N/A |
| AIP 6 | Delegation pool for node operators |
| AIP 7 | Transaction fee distribution |
| AIP 8 | Higher-Order Inline Functions for Collections |
| AIP 9 | Resource Groups |
| AIP 10 | Move Objects |
| AIP 11 | Tokens as Objects |
| AIP 12 | Multisig Accounts v2 |
| AIP 13 | Coin Standard Improvements |
| AIP 14 | Update vesting contract |
| AIP 15 | Update and rename token_standard_reserved_properties |
| AIP 16 | New cryptography natives for hashing and MultiEd25519 PK validation |
| AIP 17 | Reducing Execution Costs by Decoupling Transaction Storage and Execution Charges |
| AIP 18 | Introducing SmartVector and SmartTable to apto_std |
| AIP 19 | Enable updating commission_percentage in staking_contract module |
| AIP 20 | Generic Cryptography Algebra and BLS12-381 Implementation |
| AIP 21 | Fungible Assets |
| AIP 22 | No-Code Token Objects |
| AIP 23 | Make Ed25519 Public Key Validation Return False if Key Is the Wrong Length |
| AIP 24 | Move Library Updates |
| AIP 25 | Transaction Argument Support for Structs |
| ... | ... |
