import streamlit as st
import pandas as pd
from ib_connection_test import fetch_market_data, summarize_market_data

st.set_page_config(page_title="Dashboard IB", layout="wide")

st.title("Dashboard de símbolos IB")
st.write("Visualiza y analiza datos de mercado para una lista de símbolos desde Interactive Brokers.")

with st.sidebar:
    st.header("Configuración")
    host = st.text_input("Host", "127.0.0.1")
    port = st.number_input("Puerto", value=4001, min_value=1, max_value=65535)
    client_id = st.number_input("clientId", value=1, min_value=0)
    use_mock = st.checkbox("Usar modo mock", value=False)
    timeout = st.number_input("Timeout (segundos)", value=15, min_value=5, max_value=60)
    refresh = st.button("Actualizar datos")

if "data" not in st.session_state:
    st.session_state.data = pd.DataFrame()
    st.session_state.summary = pd.DataFrame()
    st.session_state.last_updated = None

if refresh:
    with st.spinner("Recibiendo datos..."):
        df, summary = fetch_market_data(host=host, port=int(port), client_id=int(client_id), mock_mode=use_mock, timeout=int(timeout))
        st.session_state.data = df
        st.session_state.summary = summary
        st.session_state.last_updated = pd.Timestamp.now()

if st.session_state.last_updated is not None:
    st.write(f"Última actualización: {st.session_state.last_updated}")

if st.session_state.summary.empty:
    st.warning("No hay datos disponibles. Haz clic en 'Actualizar datos' para cargar información.")
else:
    st.subheader("Resumen por símbolo")
    st.dataframe(st.session_state.summary)

    symbol = st.selectbox("Selecciona símbolo", st.session_state.summary["symbol"].tolist())
    if symbol:
        details = st.session_state.data[st.session_state.data["symbol"] == symbol]
        st.subheader(f"Detalle de {symbol}")
        st.dataframe(details)

        if not details.empty:
            details = details.sort_values("date")
            if "close" in details.columns:
                st.line_chart(details.set_index("date")["close"])
            if "volume" in details.columns:
                st.bar_chart(details.set_index("date")["volume"])

        metric_row = st.session_state.summary[st.session_state.summary["symbol"] == symbol]
        if not metric_row.empty:
            st.markdown("**Indicadores principales**")
            st.write(metric_row.T)

    st.subheader("Todos los datos de histórico")
    st.dataframe(st.session_state.data)

st.markdown("---")
st.write("Si no hay respuesta de IB, el modo mock genera datos simulados para continuar el análisis.")
