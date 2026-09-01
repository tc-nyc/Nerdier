// Root build file. Versions are declared here and inherited by :app.
// NOTE: AGP 9 has built-in Kotlin support, so `org.jetbrains.kotlin.android`
// must NOT be applied — AGP fails the build if it is.
// Pinned to the toolchain actually installed on this machine: Android Studio
// 2026.1 (bundled JDK 25) with SDK platform 37 and build-tools 36.0.0.
plugins {
    id("com.android.application") version "9.3.1" apply false
    // From Kotlin 2.0 on, the Compose compiler ships as a Kotlin plugin rather
    // than a composeOptions block.
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.10" apply false
}
