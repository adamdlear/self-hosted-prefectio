from prefect import flow, task

@task
def add(x: int, y: int) -> int:
    return x + y

@task
def log_result(result: int):
    print(f"The result is: {result}")

@flow
def example():
    a = 3
    b = 4
    sum_result = add(a, b)
    log_result(sum_result)
