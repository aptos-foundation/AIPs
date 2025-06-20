---
aip: 95
title: Collection Permissions Update
author: johnchanguk, briungri
discussions-to (*optional):
Status: Accepted
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Framework
created: 07/15/2024
updated (*optional): <mm/dd/yyyy>
---

# AIP-95 - Collection Permissions Update

## Summary

This AIP aims to change the permissions for creating tokens within a collection. Currently, only the `creator` of the collection has the authority to create tokens, and this `creator` cannot be changed once the collection has been initially created. This restriction ties token creation to a single `signer` indefinitely. The proposed change will transfer token minting permissions to the `owner` of the collection object, allowing for more flexible management of token creation and collection ownership.

## Motivation

Collections in Aptos follow the object model, where collections are encapsulated in each unique object. Different collections belong to different objects, meaning each collection has a separate owner. With the current design, this imposes limitations such as:

1. The `creator` from the `Collection` resource is only able to create tokens, which means no other address is able to create tokens.
2. When the collection ownership is transferred to a new address, the new owner is still not able to create tokens. The original owner (`creator`) is able to continue to create tokens.
   1. This does not make sense as giving up ownership semantically means giving up rights to the collection.

**Proposed Solution**

The proposed solution is to have the `owner` of the collection object have permissions to create tokens. This gives a lot more flexibility such as:

1. The collection can have different owners (transferring the collection object), meaning permissions can be transferred alongside ownership.
   1. **Organizational Transfers**: Entities such as companies can transfer ownership of collections to subsidiaries or other business units seamlessly. For example, a company can transfer a collection to a subsidiary without losing control over token creation.
   2. **Account Migrations**: In case of account migrations, the new owner can take over the collection and continue managing token creation without interruption.

By allowing the owner to mint tokens, the system ensures that only the current owner has control over token creation. This reduces the risk of unauthorized token creation by previous owners. With ownership tied to token minting, there is a clear relationship with collection management.

### Alternative Solutions

Another solution is to create a `MintRef` which is used to create tokens. `MintRef` can be created from the collection’s `ConstructorRef`. This technique is also used in the Fungible Asset module, but the only difference is creating tokens from collections requires a `signer`, as each token represents a unique object.

**MintRef Implementation**

`collection.move`

```move
/// MintRef can be used to mint a token from the collection.
struct MintRef has drop, store {
    collection: Object<Collection>
}

public fun collection(mint_ref: &MintRef): Object<Collection> {
    mint_ref.collection
}
```

`token.move`

```move
public fun create_with_mint_ref(
    minter: &signer,
    mint_ref: &MintRef,
    description: String,
    name: String,
    royalty: Option<Royalty>,
    uri: String,
): ConstructorRef {
    let constructor_ref = object::create_object(signer::address_of(minter));
    let collection = collection::collection(mint_ref);

    create_common_with_collection(
        minter,
        &constructor_ref,
        collection,
        description,
        name,
        option::none(),
        royalty,
        uri
    );
    constructor_ref
}
```

Here the `MintRef` is passed instead of the `Object<Collection>`. `MintRef` can only be generated from the `ConstructorRef`, therefore multiple people can have access to mint if they own a `MintRef`.

Although this lets more than one `signer` create tokens, having the `owner` of the collection being able to create tokens is much more intuitive. If users forget to create `MintRef` at collection construction time, this means no one can mint.

Alternatively this method can be introduced at a later stage, whilst being backwards compatible with the collection and token modules. Adding these new structs and methods can be done separately.

## Specification

In `collection.move`, collections will not have `ungated_transfer` disabled. This is because this proposal is designed for
collections to be transferred.

```move
inline fun create_collection_internal<Supply: key>(
     creator: &signer,
     constructor_ref: ConstructorRef,
     description: String,
     name: String,
     royalty: Option<Royalty>,
     uri: String,
     supply: Option<Supply>,
 ): ConstructorRef {
     assert!(string::length(&name) <= MAX_COLLECTION_NAME_LENGTH, error::out_of_range(ECOLLECTION_NAME_TOO_LONG));
     assert!(string::length(&uri) <= MAX_URI_LENGTH, error::out_of_range(EURI_TOO_LONG));
     assert!(string::length(&description) <= MAX_DESCRIPTION_LENGTH, error::out_of_range(EDESCRIPTION_TOO_LONG));

     let object_signer = object::generate_signer(&constructor_ref);

     let collection = Collection {
         creator: signer::address_of(creator),
         description,
         name,
         uri,
         mutation_events: object::new_event_handle(&object_signer),
     };
     move_to(&object_signer, collection);

     if (option::is_some(&supply)) {
         move_to(&object_signer, option::destroy_some(supply))
     } else {
         option::destroy_none(supply)
     };

     if (option::is_some(&royalty)) {
         royalty::init(&constructor_ref, option::extract(&mut royalty))
     };

     /* This line is removed to allow for the collection to be transferred.
        let transfer_ref = object::generate_transfer_ref(&constructor_ref);
        object::disable_ungated_transfer(&transfer_ref);
     */

     constructor_ref
 }
```

In `token.move`, prior to creating a token, there is a check to verify that the caller is the `creator` of the collection. This will be updated to verify that the caller is the `owner` of the collection object.

```move
inline fun create_common_with_collection(
    creator: &signer,
    constructor_ref: &ConstructorRef,
    collection: Object<Collection>,
    description: String,
    name_prefix: String,
    // If option::some, numbered token is created - i.e. index is appended to the name.
    // If option::none, name_prefix is the full name of the token.
    name_with_index_suffix: Option<String>,
    royalty: Option<Royalty>,
    uri: String,
) {
    // This line is updated to verify the owner of the collection matches the caller.
    assert!(object::owner(collection) == signer::address_of(creator), error::unauthenticated(ENOT_OWNER));

    // The rest of the code remains the same...
}
```

## Reference Implementations

https://github.com/aptos-labs/aptos-core/pull/14113

## Risks and Drawbacks

**Collection owner not equal to collection creator**

One major potential risk is backwards compatibility. Currently all tokens from a collection are minted via the `creator` of the collection. If there are collections whose `creator` is not the same as the `owner`, this introduces backwards incompatibility and malicious intent.

After collecting relevant data, the result is that there are no collections with a different `creator` and `owner`. This means currently all collections have the same `creator` and `owner`. Therefore introducing this change into the framework would not break backwards compatibility.

- The data was conducted by querying all collections, excluding collections owned by the dead wallet: `0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`.

**TransferRef not stored for the collection**

As collections are initially created with `ungated_transfer` as false, this means collections can only be transferred with a `TransferRef`.
If this was not created during construction of the collection, then this collection cannot be transferred to a new owner, meaning no other address can mint tokens from the collection.

To mitigate this, the creation of the collection will not have `ungated_transfer` disabled. This change is reflected above
in `collection.move` under `Specification`.

## **Security Considerations**

As transferring ownership of objects means transferring rights to a collection, users should be aware that transferring ownership of a collection gives away rights to the new owner. This should be clearly documented.

Furthermore, all methods to create tokens must go through the check to verify that the caller is the `owner` of the collection. Without this step, anyone is able to mint from the collection.

## Timelines

Next Release

## Future Potentials

In the future, introducing more granular minting permissions such as allowing specific members to create tokens with `MintRef` or another access based control mechanism can introduce more flexibility. This can be an addition to the collection and token module, supporting multiple keys/addresses to be able to mint.
