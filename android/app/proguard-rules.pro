# Nerdier has no reflection-based serialization and no JNI, so the default
# Android optimize rules are sufficient. Keep this file as the hook for
# future rules rather than deleting it.
-dontwarn java.lang.invoke.**
