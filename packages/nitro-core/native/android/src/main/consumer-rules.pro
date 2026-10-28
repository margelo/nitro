# JNI constructs Kotlin ULong boxes and reads them through unbox-impl.
# Its class name also identifies typed ULong arrays at the JNI boundary.
-keep class kotlin.ULong {
    <init>(long);
    long unbox-impl();
}
