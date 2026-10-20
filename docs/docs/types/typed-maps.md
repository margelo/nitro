---
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Typed maps (`Record<string, T>`)

A typed map is an object where each value is of the given type `T`.

For example, if your API returns a map of users with their ages, you _could_ use a `Record<string, number>`:

<Tabs>
  <TabItem value="ts" label="TypeScript" default>
    ```ts
    import { type HybridObject, iOS } from 'nitro-core'

    @iOS(...)
    export declare class Database extends HybridObject {
      getAllUsers(): Record<string, number>
    }
    ```
  </TabItem>
  <TabItem value="swift" label="Swift">
    ```swift
    class HybridDatabase: HybridDatabaseSpec {
      func getAllUsers() throws -> Dictionary<String, Double>
    }
    ```
  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin
    class HybridDatabase: HybridDatabaseSpec() {
      override fun getAllUsers(): Map<String, Double>
    }
    ```
  </TabItem>
  <TabItem value="cpp" label="C++">
    ```cpp
    class HybridDatabase: public HybridDatabaseSpec {
      std::unordered_map<std::string, double> getAllUsers() override;
    };
    ```
  </TabItem>
</Tabs>

:::tip
While typed maps are very efficient, Nitro cannot sufficiently optimize the object as keys are not known in advance.
If possible, **avoid typed maps** and use [arrays](arrays) for unknown number of items, or [strongly typed objects](custom-structs) for known number of items instead.
:::
