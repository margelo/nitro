import time

nanoseconds = time.monotonic_ns()
milliseconds = nanoseconds // 1_000_000
print(milliseconds)
