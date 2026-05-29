# VeggieAI CNN TensorFlow Serving

Internal TensorFlow Serving model service for the VeggieAI school project.

The service hosts two exported SavedModel classifiers:

- `vege_classifier_23`
- `vege_classifier_101`

It is intended to run only inside the Docker Compose network and be called by
`school-veggie-ai-ca2` through `http://school-veggie-ai-cnn:8501`.
