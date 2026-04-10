import os

def get_auth():
    if os.environ.get("ENABLE_NEW_AUTH") == "true":
        return new_auth()
    return legacy_auth()

def search(query):
    flag = os.environ.get("FEATURE_SEARCH_V2")
    if flag:
        return search_v2(query)
    return search_v1(query)
