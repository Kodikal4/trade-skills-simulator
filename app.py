import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify, send_from_path

app = Flask(__name__, static_folder='.')

@app.route('/')
def index():
    return send_from_path('.', 'index.html')

@app.route('/api/getChallenges', methods=['GET', 'POST'])
def handle_challenges():
    conn_string = os.environ.get("AZURE_POSTGRESQL_CONNECTION_STRING")
    
    # --- COMMAND 1: READ ROWS FROM DATABASE ---
    if request.method == 'GET':
        trade_type = request.args.get('trade_type', 'all')
        try:
            conn = psycopg2.connect(conn_string, sslmode='require')
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            if trade_type == 'all':
                cursor.execute('SELECT challengeid AS id, trade_type, component, symptom, question, failure_mode FROM "DiagnosticChallengesTable" ORDER BY challengeid DESC;')
            else:
                cursor.execute('SELECT challengeid AS id, trade_type, component, symptom, question, failure_mode FROM "DiagnosticChallengesTable" WHERE trade_type = %s ORDER BY challengeid DESC;', (trade_type,))
                
            rows = cursor.fetchall()
            cursor.close()
            conn.close()
            return jsonify(rows), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # --- COMMAND 2: WRITE A NEW ROW DIRECTLY TO POSTGRESQL ---
    elif request.method == 'POST':
        data = request.json
        try:
            conn = psycopg2.connect(conn_string, sslmode='require')
            cursor = conn.cursor()
            
            insert_query = """
                INSERT INTO "DiagnosticChallengesTable" 
                (trade_type, component, symptom, question, failure_mode, explanation, choices)
                VALUES (%s, %s, %s, %s, %s, %s, %s);
            """
            cursor.execute(insert_query, (
                data['trade_type'], data['component'], data['symptom'], 
                data['question'], data['failure_mode'], data['explanation'], data['choices']
            ))
            
            conn.commit()  # Save changes to the database permanently
            cursor.close()
            conn.close()
            return jsonify({"status": "Success, record logged to Azure Database!"}), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)