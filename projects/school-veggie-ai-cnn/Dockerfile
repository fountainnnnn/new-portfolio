FROM tensorflow/serving:latest

COPY models/ /models/

EXPOSE 8501

CMD ["--port=8500", "--rest_api_port=8501", "--model_config_file=/models/models.config", "--model_config_file_poll_wait_seconds=60"]
