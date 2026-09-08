# Scanner fixture only; never execute.
def unsafe(value):
    return eval(value)

def safe(value):
    return int(value)
