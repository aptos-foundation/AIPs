---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Code Verification API
author: 0xhsy
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Informational
created: 5/22/2023
updated (*optional): 6/23/2023
requires (*optional): <AIP number(s)>
---

# AIP-X - Code Verification API
  
(Please give a temporary file name to your AIP when first drafting it, AIP manager will assign a number to it after reviewing)

## Summary

This API proposal seeks to introduce a standard protocol for the verification of Aptos Move smart contract code. This API is designed to ensure the safety and trustworthiness of smart contract code, assisting developers in effectively verifying their code. The standard suggests the common rules that should be followed by all parties building and operating smart contract code verification API servers within the Aptos network.

Notice that this standard does not cover certification of provider of this API. Establishing trustworthiness of providers of this API is out of scope in this AIP, and left to community processes, possibly backed up by decentralized governance.

## Motivation

Blockchain is fundamentally systems for safely storing and transferring valuable assets. Many assets are managed by smart contracts, and the code of these smart contracts dictates how these assets move and are stored. Therefore, it is extremely important to verify the code of these smart contracts.

Without such a verification process, serious consequences could arise from code written incorrectly due to developer error or malicious intent. These consequences can range from the loss of specific assets to threatening the stability of the entire network.

Of course, code verification can be performed locally through the SDK. However, to increase accessibility and usability, it's most desirable to provide it through an API in the explorer.

In this proposal, I aim to address these issues by introducing a smart contract code verification API. This API will assist developers in confirming the code with which they have deployed their smart contracts. This will enhance the safety and reliability of the code and enable potential problems to be discovered and corrected in advance.

## Impact

This change will impact smart contract developers and users of the Aptos network. Developers will be able to use this API to verify their code, and users can gain confidence in the safety of the verified smart contracts.

When users know that a smart contract has been verified through this API, they gain trust that they can use that smart contract more safely. This enables users to engage in transactions and interactions within the network with greater confidence.

Therefore, this change will contribute to enhancing the overall stability and trustworthiness of the Aptos network.

## Rationale

This proposal is the most effective way to improve the stability and trustworthiness of the Aptos network. This API will help developers make smart contracts safer and play a crucial role in enhancing the network's transparency and increasing user trust. Since Aptos is designed to store the code and the compiled bytecode on-chain when deploying Move code, verification is more convenient compared to other chains.

## Specification

### **Request**

For verification of the smart contract code, developers must send a **`POST`** request to the API endpoint. It must include the following fields:

- **`address`**: The address where the smart contract to be verified is deployed.
- **`moduleName`**: The name of the module to be verified.
- **`network`**: The name of the network where the smart contract is deployed.

### **Response**

The API returns the verification result in JSON format. The response body includes the following fields:

- **`address`**: The address of the verified smart contract.
- **`network`**: The name of the network where the verification took place.
- **`isMatched`**: Whether the smart contract code matches the deployed bytecode.
- **`module`**: The name of the verified module.
- **`package`**: The name of the verified package.
- **`txHash`**: The hash value of the smart contract deployment transaction.

## Operation Details(example)

- Users request verification for a specific module in the explorer.
- When making a request, parameters such as address, network, and module name are sent together.
- The API server identifies the on-chain package metadata which declares the module and compiles this package. The resulting bytecode is compared with the bytecode on-chain.
- Results such as isMatched are returned.
- The explorer stores the verification status in the Database for utilization.

## Reference Implementation

### **Request**

```tsx
import axios from 'axios';

const API_ENDPOINT = 'https://your-api-url.com/verification';

const verifyCode = async (address, moduleName, network) => {
  const data = {
    address: address,
    moduleName: moduleName,
    network: network
  };

  try {
    const response = await axios.post(API_ENDPOINT, data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Verification result:', response.data);
  } catch (error) {
    console.error('Error during verification:', error);
  }
};
```

### **Response**

```tsx
{
  "address": "0xf85abc9014147f788f3151e900ef835d5d083ff5e1844382a8b1a488dcb5440e",
  "network": "devnet",
  "isMatched": true,
  "module": "BasicCoin1",
  "package": "BasicCoin1",
  "txHash": "0xb8b5ec79703b9a31a03c47572f7a2aff6906ddc4a980948429ef04dda960d291"
}
```

## Future Potential

Acceptance of this proposal will be a positive step in fostering the growth and maturity of the Aptos network. In the case of Ethereum, it has been proven that most developers are already utilizing code verification on explorer. Therefore, introducing such a feature to the Aptos network will also benefit its users.

Once the API is widely adopted, all smart contracts operating on the Aptos network will be verified through it. This will enable both developers and users to have a higher level of confidence in the safety of smart contracts.

## Timeline

This API can be used by various third parties, but it fits best with explorers. It's best to focus as much as possible on usability within explorers. I am considering supporting devnet, testnet, and mainnet within 4 weeks.