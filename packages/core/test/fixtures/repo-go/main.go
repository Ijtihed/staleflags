package main

import "os"

func main() {
    if os.Getenv("ENABLE_NEW_ROUTER") == "true" {
        useNewRouter()
    } else {
        useOldRouter()
    }
}
