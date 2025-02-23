# Week 4

This folder contains the notebooks for week 4 of the University of Edinburgh Space Data course.

## How to run a notebook

1. Ensure you have Python [installed](https://www.python.org/downloads/).
2. Create a virtual environment that we can store our dependencies in.

    ```sh
    python3 -m venv .venv
    ```

3. Activate the virtual environment.

    ```sh
    source .venv/bin/activate
    ```

4. Install the dependencies.

    ```sh
    pip install --upgrade pip
    pip install -r requirements.txt
    ```

5. Start up the Jupyter notebook.

    ```sh
    jupyter notebook notebook_name.ipynb
    ```

6. When you are ready to stop using the notebook, shut it down in the browser and then use `CTRL-c` in your terminal to shut down the Jupyter server. The use the following command to exit the virtual environment.

    ```sh
    deactivate
    ```
