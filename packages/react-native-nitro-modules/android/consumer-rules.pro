# AnyJSON+Serialization.kt is compiled against kotlinx-serialization-json as a compileOnly
# dependency. R8 removes it when nothing calls it, but app rules such as
# `-keep class com.margelo.nitro.** { *; }` keep it, and R8 then fails on the missing
# kotlinx classes in apps that don't use kotlinx. Only silence references from that file,
# so apps that call encode/decode without kotlinx still fail in R8 instead of at runtime.
-dontwarn com.margelo.nitro.core.AnyJSONSerialization*
